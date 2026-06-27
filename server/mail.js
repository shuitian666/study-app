import crypto from 'node:crypto';
import { db, nowIso } from './db.js';
import { hasPermission } from './admin.js';

const VALID_REWARD_TYPES = new Set([
  'coin',
  'experience',
  'regular_ticket',
  'up_ticket',
  'makeup_card',
  'avatar_frame',
  'background',
  'theme',
  'title',
  'vip',
]);
const VALID_RARITIES = new Set(['N', 'R', 'SR', 'SSR']);
const INVENTORY_REWARD_TYPES = new Set(['avatar_frame', 'background', 'theme', 'title', 'vip']);

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function cleanText(value, max = 200) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanMultilineText(value, max = 4000) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

function cleanOptional(value, max = 200) {
  const text = cleanText(value, max);
  return text || null;
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

function normalizeAttachment(input = {}, position = 0) {
  const type = cleanText(input.type || input.rewardType, 40);
  if (!VALID_REWARD_TYPES.has(type)) throw httpError(400, 'Invalid mail attachment type');
  const quantity = Math.max(1, Math.min(99999, Math.round(Number(input.quantity) || 1)));
  const name = cleanText(input.name || defaultAttachmentName(type), 80);
  return {
    id: `att_${crypto.randomUUID()}`,
    position,
    type,
    name,
    description: cleanOptional(input.description, 300),
    icon: cleanOptional(input.icon, 20),
    rarity: VALID_RARITIES.has(input.rarity) ? input.rarity : null,
    quantity,
    payload: input.payload && typeof input.payload === 'object' ? input.payload : {},
  };
}

function defaultAttachmentName(type) {
  return {
    coin: 'Star coins',
    experience: 'Experience',
    regular_ticket: 'Regular draw ticket',
    up_ticket: 'UP draw ticket',
    makeup_card: 'Makeup card',
    avatar_frame: 'Avatar frame',
    background: 'Background',
    theme: 'Theme',
    title: 'Title',
    vip: 'VIP card',
  }[type] || 'Reward';
}

function rowToAttachment(row, claimedIds = new Set()) {
  const claimedSet = claimedIds instanceof Set ? claimedIds : new Set();
  return {
    id: row.id,
    type: row.reward_type,
    name: row.name,
    description: row.description,
    icon: row.icon,
    rarity: row.rarity,
    quantity: row.quantity,
    claimed: claimedSet.has(row.id),
  };
}

function rowToMail(row, attachments) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    sender: row.sender_name || 'System',
    sentAt: row.created_at,
    read: Boolean(row.read_at),
    attachments,
    claimDeadline: row.claim_deadline,
    systemMail: Boolean(row.system_mail),
    claimed: attachments.length > 0 && attachments.every(attachment => attachment.claimed),
    version: row.version,
  };
}

function resolveRecipients(audience = {}) {
  const type = audience.type === 'users' ? 'users' : 'all';
  if (type === 'all') {
    return db.prepare('SELECT id FROM users').all().map(row => row.id);
  }
  const ids = Array.isArray(audience.userIds) ? audience.userIds.map(String).filter(Boolean) : [];
  if (ids.length === 0) throw httpError(400, 'No mail recipients selected');
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`SELECT id FROM users WHERE id IN (${placeholders})`).all(...ids).map(row => row.id);
}

export function createSystemMail(actor, input = {}) {
  if (!hasPermission(actor, 'mail.send')) throw httpError(403, 'Mail permission required');
  const title = cleanText(input.title, 120);
  const content = cleanMultilineText(input.content, 4000);
  if (!title) throw httpError(400, 'Mail title is required');
  if (!content) throw httpError(400, 'Mail content is required');

  const audience = input.audience && typeof input.audience === 'object' ? input.audience : { type: 'all' };
  const recipients = [...new Set(resolveRecipients(audience))];
  if (recipients.length === 0) throw httpError(400, 'No mail recipients selected');
  const attachments = (Array.isArray(input.attachments) ? input.attachments : [])
    .slice(0, 10)
    .map(normalizeAttachment);
  if (attachments.length > 0 && !hasPermission(actor, 'reward.grant')) {
    throw httpError(403, 'Reward permission required');
  }

  const claimDeadlineDate = input.claimDeadline
    ? new Date(input.claimDeadline)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(claimDeadlineDate.getTime())) throw httpError(400, 'Invalid claim deadline');
  const claimDeadline = claimDeadlineDate.toISOString();

  const mailId = `mail_${crypto.randomUUID()}`;
  const timestamp = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`
      INSERT INTO system_mails (
        id, sender_user_id, title, content, audience_type, audience_payload,
        claim_deadline, version, system_mail, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
    `).run(
      mailId,
      actor.id,
      title,
      content,
      audience.type === 'users' ? 'users' : 'all',
      JSON.stringify(audience),
      claimDeadline,
      timestamp,
      timestamp,
    );

    const insertRecipient = db.prepare(`
      INSERT OR IGNORE INTO mail_recipients (id, mail_id, user_id, created_at)
      VALUES (?, ?, ?, ?)
    `);
    for (const userId of recipients) {
      insertRecipient.run(`mrc_${crypto.randomUUID()}`, mailId, userId, timestamp);
    }

    const insertAttachment = db.prepare(`
      INSERT INTO mail_attachments (
        id, mail_id, position, reward_type, name, description, icon, rarity,
        quantity, payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    attachments.forEach((attachment, index) => {
      insertAttachment.run(
        attachment.id,
        mailId,
        index,
        attachment.type,
        attachment.name,
        attachment.description,
        attachment.icon,
        attachment.rarity,
        attachment.quantity,
        JSON.stringify(attachment.payload),
        timestamp,
      );
    });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return {
    mail: getSystemMailForAdmin(mailId),
    recipientCount: recipients.length,
  };
}

export function getSystemMailForAdmin(mailId) {
  const row = db.prepare(`
    SELECT m.*, u.nickname AS sender_name
    FROM system_mails m
    JOIN users u ON u.id = m.sender_user_id
    WHERE m.id = ?
  `).get(mailId);
  if (!row) throw httpError(404, 'Mail not found');
  const attachments = db.prepare('SELECT * FROM mail_attachments WHERE mail_id = ? ORDER BY position').all(mailId)
    .map(rowToAttachment);
  return rowToMail(row, attachments);
}

export function listUserMails(userId) {
  const rows = db.prepare(`
    SELECT m.*, r.read_at, u.nickname AS sender_name
    FROM mail_recipients r
    JOIN system_mails m ON m.id = r.mail_id
    JOIN users u ON u.id = m.sender_user_id
    WHERE r.user_id = ?
    ORDER BY m.created_at DESC
    LIMIT 100
  `).all(userId);
  if (rows.length === 0) return [];
  const mailIds = rows.map(row => row.id);
  const placeholders = mailIds.map(() => '?').join(',');
  const attachmentRows = db.prepare(`
    SELECT * FROM mail_attachments
    WHERE mail_id IN (${placeholders})
    ORDER BY mail_id, position
  `).all(...mailIds);
  const claimRows = db.prepare(`
    SELECT attachment_id FROM mail_claims
    WHERE user_id = ? AND mail_id IN (${placeholders})
  `).all(userId, ...mailIds);
  const claimedIds = new Set(claimRows.map(row => row.attachment_id));
  const attachmentsByMail = new Map();
  for (const attachment of attachmentRows) {
    const list = attachmentsByMail.get(attachment.mail_id) || [];
    list.push(rowToAttachment(attachment, claimedIds));
    attachmentsByMail.set(attachment.mail_id, list);
  }
  return rows.map(row => rowToMail(row, attachmentsByMail.get(row.id) || []));
}

export function getMailState(userId) {
  return {
    mails: listUserMails(userId),
    currentVersion: 1,
  };
}

export function markMailRead(userId, mailId) {
  const recipient = db.prepare('SELECT * FROM mail_recipients WHERE user_id = ? AND mail_id = ?').get(userId, mailId);
  if (!recipient) throw httpError(404, 'Mail not found');
  if (!recipient.read_at) {
    db.prepare('UPDATE mail_recipients SET read_at = ? WHERE id = ?').run(nowIso(), recipient.id);
  }
  return getMailState(userId);
}

function grantInventoryItem(userId, attachment, timestamp) {
  const itemType = attachment.reward_type === 'vip' ? 'vip_card' : attachment.reward_type;
  const payload = {
    description: attachment.description || attachment.name,
    icon: attachment.icon || 'Gift',
    rarity: attachment.rarity || 'R',
    source: 'mail',
    usable: itemType === 'vip_card',
    sourceId: `mail:${attachment.mail_id}:${attachment.id}`,
  };
  const existing = db.prepare(`
    SELECT * FROM inventory_items
    WHERE user_id = ? AND item_type = ? AND name = ?
  `).get(userId, itemType, attachment.name);
  if (existing && ['vip_card'].includes(itemType)) {
    db.prepare('UPDATE inventory_items SET quantity = quantity + ?, updated_at = ? WHERE id = ?')
      .run(attachment.quantity, timestamp, existing.id);
    return existing.id;
  }
  if (existing) return existing.id;
  const id = `inv_${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO inventory_items (id, user_id, item_type, name, quantity, payload, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, itemType, attachment.name, attachment.quantity, JSON.stringify(payload), timestamp, timestamp);
  return id;
}

function applyAttachmentReward(userId, attachment, timestamp) {
  const quantity = attachment.quantity;
  if (attachment.reward_type === 'coin') {
    db.prepare('UPDATE user_assets SET coins = coins + ?, updated_at = ? WHERE user_id = ?')
      .run(quantity, timestamp, userId);
    return { coinsDelta: quantity, experienceDelta: 0 };
  }
  if (attachment.reward_type === 'experience') {
    db.prepare('UPDATE user_assets SET experience = experience + ?, updated_at = ? WHERE user_id = ?')
      .run(quantity, timestamp, userId);
    return { coinsDelta: 0, experienceDelta: quantity };
  }
  if (attachment.reward_type === 'regular_ticket') {
    db.prepare('UPDATE user_assets SET regular_tickets = regular_tickets + ?, updated_at = ? WHERE user_id = ?')
      .run(quantity, timestamp, userId);
    return { coinsDelta: 0, experienceDelta: 0 };
  }
  if (attachment.reward_type === 'up_ticket') {
    db.prepare('UPDATE user_assets SET up_tickets = up_tickets + ?, updated_at = ? WHERE user_id = ?')
      .run(quantity, timestamp, userId);
    return { coinsDelta: 0, experienceDelta: 0 };
  }
  if (attachment.reward_type === 'makeup_card') {
    db.prepare('UPDATE user_assets SET makeup_cards = makeup_cards + ?, updated_at = ? WHERE user_id = ?')
      .run(quantity, timestamp, userId);
    return { coinsDelta: 0, experienceDelta: 0 };
  }
  if (INVENTORY_REWARD_TYPES.has(attachment.reward_type)) {
    grantInventoryItem(userId, attachment, timestamp);
    return { coinsDelta: 0, experienceDelta: 0 };
  }
  throw httpError(400, 'Unsupported mail reward');
}

export function claimMailAttachment(userId, mailId, attachmentIdOrPosition) {
  const recipient = db.prepare(`
    SELECT r.*, m.claim_deadline
    FROM mail_recipients r
    JOIN system_mails m ON m.id = r.mail_id
    WHERE r.user_id = ? AND r.mail_id = ?
  `).get(userId, mailId);
  if (!recipient) throw httpError(404, 'Mail not found');
  if (Date.parse(recipient.claim_deadline) < Date.now()) throw httpError(400, 'Mail attachment expired');

  const byPosition = Number.isInteger(Number(attachmentIdOrPosition));
  const attachment = byPosition
    ? db.prepare('SELECT * FROM mail_attachments WHERE mail_id = ? AND position = ?').get(mailId, Number(attachmentIdOrPosition))
    : db.prepare('SELECT * FROM mail_attachments WHERE mail_id = ? AND id = ?').get(mailId, String(attachmentIdOrPosition || ''));
  if (!attachment) throw httpError(404, 'Mail attachment not found');

  let claimed = false;
  db.exec('BEGIN IMMEDIATE');
  try {
    const timestamp = nowIso();
    const inserted = db.prepare(`
      INSERT OR IGNORE INTO mail_claims (id, mail_id, attachment_id, user_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(`mcl_${crypto.randomUUID()}`, mailId, attachment.id, userId, timestamp);
    if (inserted.changes > 0) {
      const delta = applyAttachmentReward(userId, attachment, timestamp);
      db.prepare(`
        INSERT OR IGNORE INTO asset_ledger (
          id, user_id, event_type, source_id, coins_delta, experience_delta, metadata, created_at
        ) VALUES (?, ?, 'mail_reward', ?, ?, ?, ?, ?)
      `).run(
        `led_${crypto.randomUUID()}`,
        userId,
        `mail:${mailId}:${attachment.id}`,
        delta.coinsDelta,
        delta.experienceDelta,
        JSON.stringify({
          mailId,
          attachmentId: attachment.id,
          type: attachment.reward_type,
          name: attachment.name,
          quantity: attachment.quantity,
        }),
        timestamp,
      );
      claimed = true;
    }
    if (!recipient.read_at) {
      db.prepare('UPDATE mail_recipients SET read_at = ? WHERE id = ?').run(timestamp, recipient.id);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return { claimed, mail: getMailState(userId) };
}

export function listAdminMails(actor, limit = 50) {
  if (!hasPermission(actor, 'mail.send')) throw httpError(403, 'Mail permission required');
  const rows = db.prepare(`
    SELECT m.*, u.nickname AS sender_name,
      COUNT(DISTINCT r.user_id) AS recipient_count,
      COUNT(DISTINCT c.id) AS claim_count
    FROM system_mails m
    JOIN users u ON u.id = m.sender_user_id
    LEFT JOIN mail_recipients r ON r.mail_id = m.id
    LEFT JOIN mail_claims c ON c.mail_id = m.id
    GROUP BY m.id
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 50, 1), 100));
  return rows.map(row => ({
    ...rowToMail(row, []),
    recipientCount: row.recipient_count,
    claimCount: row.claim_count,
  }));
}
