import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after, beforeEach } from 'node:test';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'study-admin-mail-'));
process.env.SUPER_ADMIN_EMAILS = '3546064605@qq.com';

const { db, createUser } = await import('./db.js');
const {
  ROLES,
  getAdminStatus,
  grantRole,
} = await import('./admin.js');
const {
  claimMailAttachment,
  createSystemMail,
  getMailState,
} = await import('./mail.js');

function clearDb() {
  for (const table of [
    'mail_claims',
    'mail_attachments',
    'mail_recipients',
    'system_mails',
    'user_roles',
    'asset_ledger',
    'inventory_items',
    'user_assets',
    'user_game_state',
    'user_ai_configs',
    'ai_quota',
    'sessions',
    'email_codes',
    'users',
  ]) {
    db.prepare(`DELETE FROM ${table}`).run();
  }
}

function makeUser(email = `user-${crypto.randomUUID()}@example.com`) {
  return createUser(email, 'hash');
}

beforeEach(clearDb);

after(() => {
  db.close?.();
});

test('seed email is recognized as super admin', () => {
  const owner = makeUser('3546064605@qq.com');
  const status = getAdminStatus(owner);

  assert.equal(status.role, ROLES.SUPER_ADMIN);
  assert.equal(status.permissions.includes('admin.roles.manage'), true);
  assert.equal(status.permissions.includes('mail.send'), true);
});

test('truth admin emails are not promoted to super admin', () => {
  const originalSuperAdmins = process.env.SUPER_ADMIN_EMAILS;
  const originalTruthAdmins = process.env.TRUTH_ADMIN_EMAILS;
  delete process.env.SUPER_ADMIN_EMAILS;
  process.env.TRUTH_ADMIN_EMAILS = 'legacy-truth@example.com';
  try {
    const legacyAdmin = makeUser('legacy-truth@example.com');
    const seedOwner = makeUser('3546064605@qq.com');

    const legacyStatus = getAdminStatus(legacyAdmin);
    assert.equal(legacyStatus.role, ROLES.USER);
    assert.equal(legacyStatus.permissions.includes('truth.assets.edit'), false);
    assert.equal(getAdminStatus(seedOwner).role, ROLES.SUPER_ADMIN);
  } finally {
    if (originalSuperAdmins === undefined) delete process.env.SUPER_ADMIN_EMAILS;
    else process.env.SUPER_ADMIN_EMAILS = originalSuperAdmins;
    if (originalTruthAdmins === undefined) delete process.env.TRUTH_ADMIN_EMAILS;
    else process.env.TRUTH_ADMIN_EMAILS = originalTruthAdmins;
  }
});

test('super admin can grant sub admin and admin roles', () => {
  const owner = makeUser('3546064605@qq.com');
  const helper = makeUser();
  const manager = makeUser();

  assert.equal(grantRole(owner, helper.id, ROLES.SUB_ADMIN).role, ROLES.SUB_ADMIN);
  assert.equal(grantRole(owner, manager.id, ROLES.ADMIN).role, ROLES.ADMIN);

  assert.equal(getAdminStatus(helper).permissions.includes('truth.assets.upload'), true);
  assert.equal(getAdminStatus(helper).permissions.includes('mail.send'), false);
  assert.equal(getAdminStatus(manager).permissions.includes('mail.send'), true);
});

test('sub admin cannot send system mail', () => {
  const owner = makeUser('3546064605@qq.com');
  const helper = makeUser();
  grantRole(owner, helper.id, ROLES.SUB_ADMIN);

  assert.throws(
    () => createSystemMail(helper, { title: 'Hello', content: 'World' }),
    err => err.status === 403,
  );
});

test('invalid mail claim deadline returns a validation error', () => {
  const owner = makeUser('3546064605@qq.com');
  const recipient = makeUser();

  assert.throws(
    () => createSystemMail(owner, {
      title: 'Invalid deadline',
      content: 'This should not be created.',
      audience: { type: 'users', userIds: [recipient.id] },
      claimDeadline: 'not-a-date',
    }),
    err => err.status === 400 && err.message === 'Invalid claim deadline',
  );
});

test('admin reward mail requires reward grant permission', () => {
  const owner = makeUser('3546064605@qq.com');
  const manager = makeUser();
  const recipient = makeUser();
  grantRole(owner, manager.id, ROLES.ADMIN);

  assert.doesNotThrow(() => createSystemMail(manager, {
    title: 'Plain notice',
    content: 'No rewards attached.',
    audience: { type: 'users', userIds: [recipient.id] },
  }));
  assert.doesNotThrow(() => createSystemMail(manager, {
    title: 'Reward notice',
    content: 'Rewards attached.',
    audience: { type: 'users', userIds: [recipient.id] },
    attachments: [{ type: 'coin', name: 'Star coins', quantity: 1 }],
  }));
});

test('mail attachment claim is idempotent and updates account assets', () => {
  const owner = makeUser('3546064605@qq.com');
  const recipient = makeUser();
  const created = createSystemMail(owner, {
    title: 'Reward',
    content: 'Thanks for studying.',
    audience: { type: 'users', userIds: [recipient.id] },
    attachments: [{ type: 'coin', name: 'Star coins', quantity: 25 }],
  });
  const mail = getMailState(recipient.id).mails[0];
  assert.equal(created.recipientCount, 1);
  assert.equal(mail.attachments[0].claimed, false);

  const first = claimMailAttachment(recipient.id, mail.id, mail.attachments[0].id);
  const second = claimMailAttachment(recipient.id, mail.id, mail.attachments[0].id);
  const assets = db.prepare('SELECT * FROM user_assets WHERE user_id = ?').get(recipient.id);
  const ledger = db.prepare(`
    SELECT * FROM asset_ledger
    WHERE user_id = ? AND event_type = 'mail_reward'
  `).all(recipient.id);

  assert.equal(first.claimed, true);
  assert.equal(second.claimed, false);
  assert.equal(assets.coins, 25);
  assert.equal(ledger.length, 1);
});
