import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after, beforeEach } from 'node:test';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'study-reminders-'));

const { createUser, db, updateUserProfile } = await import('./db.js');
const { performCheckin } = await import('./account.js');
const { patchLearningProgress } = await import('./learning.js');
const {
  dispatchDueReminders,
  evaluateDailyReminderState,
  getReminderPreferences,
  updateReminderPreferences,
} = await import('./reminders.js');

function clearDb() {
  for (const table of [
    'notification_log',
    'push_subscriptions',
    'notification_preferences',
    'user_learning_progress',
    'checkin_records',
    'asset_ledger',
    'inventory_items',
    'ai_quota',
    'user_ai_configs',
    'user_game_state',
    'user_assets',
    'sessions',
    'email_codes',
    'users',
  ]) {
    db.prepare(`DELETE FROM ${table}`).run();
  }
}

function makeUser() {
  return createUser(`user-${crypto.randomUUID()}@example.com`, 'hash');
}

function addProgress(userId, records) {
  patchLearningProgress(userId, {
    progress: records.map((record, index) => ({
      id: `progress-${index}`,
      knowledgePointId: record.knowledgePointId,
      studyRecords: record.studyRecords || [],
      quizRecords: record.quizRecords || [],
      quizSessions: record.quizSessions || [],
      updatedAt: record.updatedAt || '2026-06-27T12:00:00.000Z',
    })),
  });
}

beforeEach(clearDb);

after(() => {
  db.close?.();
});

test('reminder state prioritizes unfinished daily learning', () => {
  const user = makeUser();
  updateUserProfile(user.id, { dailyGoal: 3 });
  addProgress(user.id, [{
    knowledgePointId: 'kp-1',
    studyRecords: [{ date: '2026-06-27T10:00:00.000Z', score: 80, knowledgePointId: 'kp-1' }],
  }]);

  const state = evaluateDailyReminderState(user.id, new Date('2026-06-27T12:00:00.000Z'), 'Asia/Shanghai');

  assert.equal(state.kind, 'learning');
  assert.equal(state.learningCount, 1);
  assert.equal(state.remainingCount, 2);
});

test('reminder state asks for checkin after the learning goal is complete', () => {
  const user = makeUser();
  updateUserProfile(user.id, { dailyGoal: 1 });
  addProgress(user.id, [{
    knowledgePointId: 'kp-1',
    studyRecords: [{ date: '2026-06-27T10:00:00.000Z', score: 80, knowledgePointId: 'kp-1' }],
  }]);

  const pending = evaluateDailyReminderState(user.id, new Date('2026-06-27T12:00:00.000Z'), 'Asia/Shanghai');
  performCheckin(user.id, { date: pending.dateKey });
  const done = evaluateDailyReminderState(user.id, new Date('2026-06-27T12:00:00.000Z'), 'Asia/Shanghai');

  assert.equal(pending.kind, 'checkin');
  assert.equal(done.kind, 'none');
});

test('reminder preferences normalize unsafe input', () => {
  const user = makeUser();

  const saved = updateReminderPreferences(user.id, {
    enabled: true,
    reminderTime: '99:99',
    timezone: 'bad-zone',
    emailFallbackEnabled: false,
  });
  const loaded = getReminderPreferences(user.id);

  assert.equal(saved.reminderTime, '20:00');
  assert.equal(saved.timezone, 'Asia/Shanghai');
  assert.equal(loaded.enabled, true);
  assert.equal(loaded.emailFallbackEnabled, false);
});

test('dispatch sends one email fallback per user date and reminder kind', async () => {
  const user = makeUser();
  updateUserProfile(user.id, { dailyGoal: 2 });
  addProgress(user.id, [{
    knowledgePointId: 'kp-1',
    studyRecords: [{ date: '2026-06-27T10:00:00.000Z', score: 80, knowledgePointId: 'kp-1' }],
  }]);
  updateReminderPreferences(user.id, {
    enabled: true,
    reminderTime: '20:00',
    timezone: 'Asia/Shanghai',
    emailFallbackEnabled: true,
  });

  const now = new Date('2026-06-27T12:01:00.000Z');
  const first = await dispatchDueReminders(now);
  const second = await dispatchDueReminders(now);
  const logs = db.prepare(`
    SELECT * FROM notification_log
    WHERE user_id = ? AND kind = 'learning' AND channel = 'email'
  `).all(user.id);

  assert.equal(first.length, 1);
  assert.equal(first[0].emailSent, true);
  assert.equal(second.length, 1);
  assert.equal(second[0].emailSent, false);
  assert.equal(logs.length, 1);
});

test('reminder state counts synced quiz sessions toward the daily goal', () => {
  const user = makeUser();
  updateUserProfile(user.id, { dailyGoal: 5 });
  addProgress(user.id, [{
    knowledgePointId: '__quiz_sessions__',
    quizSessions: [{
      id: 'quiz-session-1',
      totalQuestions: 5,
      completedAt: '2026-06-27T10:00:00.000Z',
    }],
  }]);

  const state = evaluateDailyReminderState(user.id, new Date('2026-06-27T12:00:00.000Z'), 'Asia/Shanghai');

  assert.equal(state.kind, 'checkin');
  assert.equal(state.learningCount, 5);
  assert.equal(state.remainingCount, 0);
});

test('dispatch still sends after the exact reminder window has passed', async () => {
  const user = makeUser();
  updateUserProfile(user.id, { dailyGoal: 2 });
  addProgress(user.id, [{
    knowledgePointId: 'kp-1',
    studyRecords: [{ date: '2026-06-27T10:00:00.000Z', score: 80, knowledgePointId: 'kp-1' }],
  }]);
  updateReminderPreferences(user.id, {
    enabled: true,
    reminderTime: '20:00',
    timezone: 'Asia/Shanghai',
    emailFallbackEnabled: true,
  });

  const result = await dispatchDueReminders(new Date('2026-06-27T12:25:00.000Z'));

  assert.equal(result.length, 1);
  assert.equal(result[0].kind, 'learning');
  assert.equal(result[0].emailSent, true);
});

test('failed email log does not prevent a later retry from being sent', async () => {
  const user = makeUser();
  updateUserProfile(user.id, { dailyGoal: 2 });
  addProgress(user.id, [{
    knowledgePointId: 'kp-1',
    studyRecords: [{ date: '2026-06-27T10:00:00.000Z', score: 80, knowledgePointId: 'kp-1' }],
  }]);
  updateReminderPreferences(user.id, {
    enabled: true,
    reminderTime: '20:00',
    timezone: 'Asia/Shanghai',
    emailFallbackEnabled: true,
  });
  db.prepare(`
    INSERT INTO notification_log (id, user_id, date_key, kind, channel, status, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `nlg_${crypto.randomUUID()}`,
    user.id,
    '2026-06-27',
    'learning',
    'email',
    'failed',
    JSON.stringify({ message: 'temporary failure' }),
    '2026-06-27T12:00:00.000Z',
  );

  const result = await dispatchDueReminders(new Date('2026-06-27T12:01:00.000Z'));
  const log = db.prepare(`
    SELECT status FROM notification_log
    WHERE user_id = ? AND date_key = ? AND kind = ? AND channel = ?
  `).get(user.id, '2026-06-27', 'learning', 'email');

  assert.equal(result.length, 1);
  assert.equal(result[0].emailSent, true);
  assert.equal(log.status, 'sent');
});
