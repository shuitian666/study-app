import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after, beforeEach } from 'node:test';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'study-account-'));

const { db, createUser, nowIso } = await import('./db.js');
const {
  REDEMPTION_CODES,
  buyShopItem,
  drawLotteryForUser,
  performCheckin,
  redeemCode,
  useInventoryItem,
} = await import('./account.js');

function clearDb() {
  for (const table of [
    'asset_ledger',
    'checkin_records',
    'inventory_items',
    'ai_usage_daily',
    'ai_quota',
    'user_ai_configs',
    'user_game_state',
    'user_assets',
    'sessions',
    'sms_codes',
    'email_codes',
    'users',
  ]) {
    db.prepare(`DELETE FROM ${table}`).run();
  }
}

function makeUser() {
  return createUser(`user-${crypto.randomUUID()}@example.com`, 'hash');
}

function setAssets(userId, patch) {
  const current = db.prepare('SELECT * FROM user_assets WHERE user_id = ?').get(userId);
  db.prepare(`
    UPDATE user_assets
    SET coins = ?, regular_tickets = ?, up_tickets = ?, makeup_cards = ?,
      lottery_pity_sr = ?, lottery_pity_ssr = ?, updated_at = ?
    WHERE user_id = ?
  `).run(
    patch.coins ?? current.coins,
    patch.regular_tickets ?? current.regular_tickets,
    patch.up_tickets ?? current.up_tickets,
    patch.makeup_cards ?? current.makeup_cards,
    patch.lottery_pity_sr ?? current.lottery_pity_sr,
    patch.lottery_pity_ssr ?? current.lottery_pity_ssr,
    nowIso(),
    userId,
  );
}

beforeEach(clearDb);

after(() => {
  db.close?.();
});

test('checkin is idempotent for the same date', () => {
  const user = makeUser();

  const first = performCheckin(user.id, { date: '2026-05-16' });
  const second = performCheckin(user.id, { date: '2026-05-16' });
  const assets = db.prepare('SELECT * FROM user_assets WHERE user_id = ?').get(user.id);
  const rows = db.prepare('SELECT * FROM checkin_records WHERE user_id = ?').all(user.id);

  assert.equal(first.drawBalance.regular, 1);
  assert.equal(second.error, 'Already checked in');
  assert.equal(assets.regular_tickets, 1);
  assert.equal(rows.length, 1);
});

test('makeup checkin requires a makeup card', () => {
  const user = makeUser();

  assert.throws(
    () => performCheckin(user.id, { date: '2026-05-15', type: 'makeup' }),
    err => err.status === 400 && err.message === 'No makeup cards available',
  );
});

test('shop purchase rejects insufficient coins', () => {
  const user = makeUser();

  assert.throws(
    () => buyShopItem(user.id, 'item-1'),
    err => err.status === 400 && err.message === 'Not enough coins',
  );
});

test('non-stackable shop purchase is not charged twice', () => {
  const user = makeUser();
  setAssets(user.id, { coins: 1000 });

  buyShopItem(user.id, 'frame-n-1');
  buyShopItem(user.id, 'frame-n-1');

  const assets = db.prepare('SELECT * FROM user_assets WHERE user_id = ?').get(user.id);
  const inventory = db.prepare('SELECT * FROM inventory_items WHERE user_id = ?').all(user.id);
  assert.equal(assets.coins, 970);
  assert.equal(inventory.length, 1);
});

test('redemption code cannot be applied twice', () => {
  const user = makeUser();
  const code = Object.keys(REDEMPTION_CODES)[0];

  redeemCode(user.id, code);
  redeemCode(user.id, code);

  const reward = REDEMPTION_CODES[code];
  const assets = db.prepare('SELECT * FROM user_assets WHERE user_id = ?').get(user.id);
  const game = db.prepare('SELECT * FROM user_game_state WHERE user_id = ?').get(user.id);
  assert.equal(assets.up_tickets, reward.upDraws);
  assert.deepEqual(JSON.parse(game.redeemed_codes), [code]);
});

test('regular single and ten draws are persisted on the server', () => {
  const user = makeUser();
  setAssets(user.id, { regular_tickets: 11 });
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    const one = drawLotteryForUser(user.id, 'regular', 1);
    const ten = drawLotteryForUser(user.id, 'regular', 10);
    const assets = db.prepare('SELECT * FROM user_assets WHERE user_id = ?').get(user.id);

    assert.equal(one.lottery.allResults.length, 1);
    assert.equal(ten.lottery.allResults.length, 10);
    assert.equal(assets.regular_tickets, 0);
    assert.equal(assets.lottery_pity_sr, 1);
    assert.equal(assets.lottery_pity_ssr, 11);
  } finally {
    Math.random = random;
  }
});

test('duplicate UP draw grants compensation and does not duplicate inventory', () => {
  const user = makeUser();
  setAssets(user.id, { up_tickets: 2 });
  const random = Math.random;
  Math.random = () => 0.99;
  try {
    drawLotteryForUser(user.id, 'up', 1);
    drawLotteryForUser(user.id, 'up', 1);
    const assets = db.prepare('SELECT * FROM user_assets WHERE user_id = ?').get(user.id);
    const inventory = db.prepare('SELECT * FROM inventory_items WHERE user_id = ?').all(user.id);

    assert.equal(assets.up_tickets, 0);
    assert.equal(assets.coins, 10);
    assert.equal(inventory.length, 1);
  } finally {
    Math.random = random;
  }
});

test('usable inventory item quantity is consumed', () => {
  const user = makeUser();
  const itemId = `inv_${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO inventory_items (id, user_id, item_type, name, quantity, payload, created_at, updated_at)
    VALUES (?, ?, 'makeup_card', 'Test Card', 2, ?, ?, ?)
  `).run(itemId, user.id, JSON.stringify({ usable: true }), nowIso(), nowIso());

  useInventoryItem(user.id, itemId);

  const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(itemId);
  assert.equal(item.quantity, 1);
});
