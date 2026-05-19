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
const {
  createTeamForUser,
  dissolveTeamForUser,
  getTeam,
  joinTeamForUser,
  updateTeamProgressForUser,
} = await import('./team.js');
const {
  deleteLearningRecords,
  getLearningBootstrap,
  importLearningBatch,
  patchLearningProgress,
} = await import('./learning.js');
const { setSessionCookie } = await import('./security.js');

function clearDb() {
  for (const table of [
    'team_events',
    'team_members',
    'teams',
    'user_import_history',
    'user_question_explanations',
    'user_wrong_records',
    'user_learning_progress',
    'user_questions',
    'user_knowledge_points',
    'user_chapters',
    'user_subjects',
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

test('session cookie is not secure by default even in production', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSecure = process.env.SESSION_COOKIE_SECURE;
  process.env.NODE_ENV = 'production';
  delete process.env.SESSION_COOKIE_SECURE;
  try {
    let cookie = '';
    setSessionCookie({ setHeader: (_, value) => { cookie = value; } }, 'session-id');
    assert.match(cookie, /SameSite=Lax/);
    assert.doesNotMatch(cookie, /;\s*Secure/);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalSecure === undefined) delete process.env.SESSION_COOKIE_SECURE;
    else process.env.SESSION_COOKIE_SECURE = originalSecure;
  }
});

test('session cookie secure flag is opt-in for cross-site HTTPS deployments', () => {
  const originalSecure = process.env.SESSION_COOKIE_SECURE;
  const originalSameSite = process.env.SESSION_COOKIE_SAMESITE;
  process.env.SESSION_COOKIE_SECURE = 'true';
  process.env.SESSION_COOKIE_SAMESITE = 'None';
  try {
    let cookie = '';
    setSessionCookie({ setHeader: (_, value) => { cookie = value; } }, 'session-id');
    assert.match(cookie, /SameSite=None/);
    assert.match(cookie, /;\s*Secure/);
  } finally {
    if (originalSecure === undefined) delete process.env.SESSION_COOKIE_SECURE;
    else process.env.SESSION_COOKIE_SECURE = originalSecure;
    if (originalSameSite === undefined) delete process.env.SESSION_COOKIE_SAMESITE;
    else process.env.SESSION_COOKIE_SAMESITE = originalSameSite;
  }
});

test('team lifecycle is persisted in sqlite', () => {
  const owner = makeUser();
  const teammate = makeUser();

  const created = createTeamForUser(owner);
  assert.equal(created.members.length, 1);
  assert.equal(created.members[0].id, owner.id);

  const joined = joinTeamForUser(created.inviteCode, teammate);
  assert.equal(joined.status, 'active');
  assert.equal(joined.members.length, 2);

  const updated = updateTeamProgressForUser(joined.id, teammate.id, {
    taskCompletionRate: 0.75,
    studyMinutes: 42,
    isReady: true,
  });
  const updatedMember = updated.members.find(member => member.id === teammate.id);
  assert.equal(updatedMember.progress.taskCompletionRate, 0.75);
  assert.equal(updatedMember.progress.studyMinutes, 42);
  assert.equal(updatedMember.progress.isReady, true);

  const reloaded = getTeam(joined.id);
  assert.equal(reloaded.members.length, 2);

  dissolveTeamForUser(joined.id, teammate.id);
  assert.equal(getTeam(joined.id), null);
});

test('team rejects progress updates from non-members', () => {
  const owner = makeUser();
  const outsider = makeUser();
  const team = createTeamForUser(owner);

  assert.throws(
    () => updateTeamProgressForUser(team.id, outsider.id, { taskCompletionRate: 1 }),
    err => err.status === 404 && err.message === 'Team member not found',
  );
});

test('learning import batch is persisted and returned by bootstrap', () => {
  const user = makeUser();

  const snapshot = importLearningBatch(user.id, {
    importId: 'import-1',
    sourceType: 'local-import',
    subjects: [{ id: 'subject-1', name: 'Pharmacy', updatedAt: '2026-05-18T00:00:00.000Z' }],
    chapters: [{ id: 'chapter-1', subjectId: 'subject-1', name: 'Basics', updatedAt: '2026-05-18T00:01:00.000Z' }],
    knowledgePoints: [{ id: 'kp-1', subjectId: 'subject-1', chapterId: 'chapter-1', title: 'Dose', updatedAt: '2026-05-18T00:02:00.000Z' }],
    questions: [{ id: 'q-1', knowledgePointId: 'kp-1', stem: 'Question', updatedAt: '2026-05-18T00:03:00.000Z' }],
  });

  assert.equal(snapshot.subjects.length, 1);
  assert.equal(snapshot.chapters[0].ownerUserId, user.id);
  assert.equal(snapshot.knowledgePoints[0].importId, 'import-1');
  assert.equal(snapshot.questions[0].sourceType, 'local-import');

  const reloaded = getLearningBootstrap(user.id);
  assert.equal(reloaded.knowledgePoints[0].title, 'Dose');
  assert.equal(reloaded.importHistory.length, 1);
});

test('learning progress patch uses per-record last-write-wins', () => {
  const user = makeUser();

  patchLearningProgress(user.id, {
    progress: [{
      id: 'progress-1',
      knowledgePointId: 'kp-1',
      fsrsState: 'Review',
      currentScore: 80,
      updatedAt: '2026-05-18T10:00:00.000Z',
    }],
    wrongRecords: [{ id: 'wrong-1', questionId: 'q-1', updatedAt: '2026-05-18T10:00:00.000Z' }],
    questionExplanations: [{ id: 'explain-1', questionId: 'q-1', explanation: 'new', updatedAt: '2026-05-18T10:00:00.000Z' }],
  });

  patchLearningProgress(user.id, {
    progress: [{
      id: 'progress-older',
      knowledgePointId: 'kp-1',
      fsrsState: 'Learning',
      currentScore: 10,
      updatedAt: '2026-05-18T09:00:00.000Z',
    }],
    questionExplanations: [{ id: 'explain-older', questionId: 'q-1', explanation: 'old', updatedAt: '2026-05-18T09:00:00.000Z' }],
  });

  const snapshot = getLearningBootstrap(user.id);
  assert.equal(snapshot.progress.length, 1);
  assert.equal(snapshot.progress[0].currentScore, 80);
  assert.equal(snapshot.progress[0].fsrsState, 'Review');
  assert.equal(snapshot.wrongRecords.length, 1);
  assert.equal(snapshot.questionExplanations[0].explanation, 'new');
});

test('learning delete can soft-delete an import batch', () => {
  const user = makeUser();

  importLearningBatch(user.id, {
    importId: 'import-delete',
    sourceType: 'local-import',
    knowledgePoints: [{ id: 'kp-delete', importId: 'import-delete', title: 'Delete me', updatedAt: '2026-05-18T00:00:00.000Z' }],
    questions: [{ id: 'q-delete', importId: 'import-delete', knowledgePointId: 'kp-delete', updatedAt: '2026-05-18T00:00:00.000Z' }],
  });

  const snapshot = deleteLearningRecords(user.id, {
    importId: 'import-delete',
    deletedAt: '2026-05-19T00:00:00.000Z',
  });

  assert.equal(snapshot.knowledgePoints[0].deletedAt, '2026-05-19T00:00:00.000Z');
  assert.equal(snapshot.questions[0].deletedAt, '2026-05-19T00:00:00.000Z');
  assert.equal(snapshot.importHistory[0].deletedAt, '2026-05-19T00:00:00.000Z');
});
