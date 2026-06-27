import crypto from 'node:crypto';
import webPush from 'web-push';
import { db, getUserById, nowIso } from './db.js';
import { sendStudyReminderEmail } from './mailer.js';

const DEFAULT_REMINDER_TIME = '20:00';
const DEFAULT_TIMEZONE = 'Asia/Shanghai';
const SCAN_INTERVAL_MINUTES = 15;

function parseJson(value, fallback = {}) {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function boolToInt(value) {
  return value ? 1 : 0;
}

function rowToPreferences(row, userId) {
  return {
    userId,
    enabled: Boolean(row?.enabled),
    reminderTime: row?.reminder_time || DEFAULT_REMINDER_TIME,
    timezone: row?.timezone || DEFAULT_TIMEZONE,
    pushEnabled: Boolean(row?.push_enabled),
    emailFallbackEnabled: row ? Boolean(row.email_fallback_enabled) : true,
  };
}

function normalizeReminderTime(value) {
  const text = String(value || DEFAULT_REMINDER_TIME).trim();
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text);
  return match ? text : DEFAULT_REMINDER_TIME;
}

function normalizeTimezone(value) {
  const timezone = String(value || DEFAULT_TIMEZONE).trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function getLocalDateKey(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getLocalMinutes(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

function reminderMinutes(reminderTime) {
  const [hour, minute] = normalizeReminderTime(reminderTime).split(':').map(Number);
  return hour * 60 + minute;
}

function isDueTime(preferences, now = new Date()) {
  const current = getLocalMinutes(now, preferences.timezone);
  const target = reminderMinutes(preferences.reminderTime);
  return current >= target;
}

function countTodayLearningFromProgress(progressRows, dateKey, timezone) {
  const flashcardKnowledgeIds = new Set();
  let quizRecordCount = 0;
  let quizSessionQuestionCount = 0;

  for (const row of progressRows) {
    if (row.deleted_at) continue;
    const payload = parseJson(row.payload, {});

    for (const record of Array.isArray(payload.studyRecords) ? payload.studyRecords : []) {
      if (getLocalDateKey(new Date(record.date), timezone) === dateKey && Number(record.score) >= 80) {
        flashcardKnowledgeIds.add(record.knowledgePointId || payload.knowledgePointId || row.knowledge_point_id);
      }
    }

    for (const record of Array.isArray(payload.quizRecords) ? payload.quizRecords : []) {
      if (getLocalDateKey(new Date(record.date), timezone) === dateKey) {
        quizRecordCount += 1;
      }
    }

    for (const session of Array.isArray(payload.quizSessions) ? payload.quizSessions : []) {
      if (getLocalDateKey(new Date(session.completedAt), timezone) === dateKey) {
        quizSessionQuestionCount += Math.max(0, Math.round(Number(session.totalQuestions) || 0));
      }
    }
  }

  return flashcardKnowledgeIds.size + quizRecordCount + quizSessionQuestionCount;
}

export function getReminderPreferences(userId) {
  const row = db.prepare('SELECT * FROM notification_preferences WHERE user_id = ?').get(userId);
  return rowToPreferences(row, userId);
}

export function updateReminderPreferences(userId, patch = {}) {
  const current = getReminderPreferences(userId);
  const next = {
    enabled: Object.prototype.hasOwnProperty.call(patch, 'enabled') ? Boolean(patch.enabled) : current.enabled,
    reminderTime: Object.prototype.hasOwnProperty.call(patch, 'reminderTime')
      ? normalizeReminderTime(patch.reminderTime)
      : current.reminderTime,
    timezone: Object.prototype.hasOwnProperty.call(patch, 'timezone')
      ? normalizeTimezone(patch.timezone)
      : current.timezone,
    pushEnabled: Object.prototype.hasOwnProperty.call(patch, 'pushEnabled') ? Boolean(patch.pushEnabled) : current.pushEnabled,
    emailFallbackEnabled: Object.prototype.hasOwnProperty.call(patch, 'emailFallbackEnabled')
      ? Boolean(patch.emailFallbackEnabled)
      : current.emailFallbackEnabled,
  };
  const timestamp = nowIso();

  db.prepare(`
    INSERT INTO notification_preferences
      (user_id, enabled, reminder_time, timezone, push_enabled, email_fallback_enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      enabled = excluded.enabled,
      reminder_time = excluded.reminder_time,
      timezone = excluded.timezone,
      push_enabled = excluded.push_enabled,
      email_fallback_enabled = excluded.email_fallback_enabled,
      updated_at = excluded.updated_at
  `).run(
    userId,
    boolToInt(next.enabled),
    next.reminderTime,
    next.timezone,
    boolToInt(next.pushEnabled),
    boolToInt(next.emailFallbackEnabled),
    timestamp,
    timestamp,
  );

  return getReminderPreferences(userId);
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || '';
}

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@example.com',
    publicKey,
    privateKey,
  );
  return true;
}

export function savePushSubscription(userId, subscription, userAgent = '') {
  if (!subscription?.endpoint || typeof subscription.endpoint !== 'string') {
    const error = new Error('Invalid push subscription');
    error.status = 400;
    throw error;
  }

  const timestamp = nowIso();
  db.prepare(`
    INSERT INTO push_subscriptions (id, user_id, endpoint, subscription_json, user_agent, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, endpoint) DO UPDATE SET
      subscription_json = excluded.subscription_json,
      user_agent = excluded.user_agent,
      updated_at = excluded.updated_at
  `).run(
    `psh_${crypto.randomUUID()}`,
    userId,
    subscription.endpoint,
    JSON.stringify(subscription),
    String(userAgent || '').slice(0, 300),
    timestamp,
    timestamp,
  );

  return updateReminderPreferences(userId, { enabled: true, pushEnabled: true });
}

export function deletePushSubscription(userId, endpoint = '') {
  if (endpoint) {
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').run(userId, endpoint);
  } else {
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(userId);
  }

  const remaining = db.prepare('SELECT 1 FROM push_subscriptions WHERE user_id = ? LIMIT 1').get(userId);
  if (!remaining) {
    updateReminderPreferences(userId, { pushEnabled: false });
  }

  return getReminderPreferences(userId);
}

export function evaluateDailyReminderState(userId, date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const user = getUserById(userId);
  const dateKey = getLocalDateKey(date, timezone);
  const dailyGoal = Math.max(1, Number(user?.daily_goal || 10));
  const progressRows = db.prepare('SELECT * FROM user_learning_progress WHERE user_id = ?').all(userId);
  const learningCount = countTodayLearningFromProgress(progressRows, dateKey, timezone);
  const checkedIn = Boolean(db.prepare('SELECT 1 FROM checkin_records WHERE user_id = ? AND date_key = ?').get(userId, dateKey));
  const remainingCount = Math.max(dailyGoal - learningCount, 0);

  if (learningCount < dailyGoal) {
    return {
      dateKey,
      kind: 'learning',
      dailyGoal,
      learningCount,
      remainingCount,
      checkedIn,
      title: '今日学习量还没完成',
      body: `还差 ${remainingCount} 项学习量，完成后就可以签到。`,
    };
  }

  if (!checkedIn) {
    return {
      dateKey,
      kind: 'checkin',
      dailyGoal,
      learningCount,
      remainingCount: 0,
      checkedIn,
      title: '今日目标已完成',
      body: '别忘了签到，领取今日奖励。',
    };
  }

  return {
    dateKey,
    kind: 'none',
    dailyGoal,
    learningCount,
    remainingCount: 0,
    checkedIn,
    title: '',
    body: '',
  };
}

function hasSent(userId, dateKey, kind, channel) {
  return Boolean(db.prepare(`
    SELECT 1 FROM notification_log
    WHERE user_id = ? AND date_key = ? AND kind = ? AND channel = ? AND status = 'sent'
  `).get(userId, dateKey, kind, channel));
}

function recordNotification(userId, reminder, channel, status, metadata = {}) {
  db.prepare(`
    INSERT INTO notification_log (id, user_id, date_key, kind, channel, status, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date_key, kind, channel) DO UPDATE SET
      status = excluded.status,
      metadata = excluded.metadata,
      created_at = excluded.created_at
  `).run(
    `nlg_${crypto.randomUUID()}`,
    userId,
    reminder.dateKey,
    reminder.kind,
    channel,
    status,
    JSON.stringify(metadata),
    nowIso(),
  );
}

async function sendPushReminders(userId, reminder) {
  if (!configureWebPush()) return false;
  const subscriptions = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
  if (subscriptions.length === 0) return false;

  let sent = false;
  for (const row of subscriptions) {
    if (hasSent(userId, reminder.dateKey, reminder.kind, `push:${row.id}`)) continue;
    try {
      await webPush.sendNotification(parseJson(row.subscription_json), JSON.stringify({
        title: reminder.title,
        body: reminder.body,
        tag: `study-reminder-${reminder.kind}-${reminder.dateKey}`,
        url: '/',
      }));
      recordNotification(userId, reminder, `push:${row.id}`, 'sent');
      sent = true;
    } catch (error) {
      recordNotification(userId, reminder, `push:${row.id}`, 'failed', { message: error.message, statusCode: error.statusCode });
      if (error.statusCode === 404 || error.statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(row.id);
      }
    }
  }
  return sent;
}

async function sendEmailReminder(user, reminder) {
  if (!user?.phone || hasSent(user.id, reminder.dateKey, reminder.kind, 'email')) return false;
  try {
    await sendStudyReminderEmail(user.phone, reminder);
    recordNotification(user.id, reminder, 'email', 'sent');
    return true;
  } catch (error) {
    recordNotification(user.id, reminder, 'email', 'failed', { message: error.message });
    return false;
  }
}

export async function dispatchDueReminders(now = new Date()) {
  const rows = db.prepare('SELECT * FROM notification_preferences WHERE enabled = 1').all();
  const results = [];

  for (const row of rows) {
    const preferences = rowToPreferences(row, row.user_id);
    if (!isDueTime(preferences, now)) continue;

    const user = getUserById(row.user_id);
    if (!user) continue;

    const reminder = evaluateDailyReminderState(row.user_id, now, preferences.timezone);
    if (reminder.kind === 'none') continue;

    const pushSent = preferences.pushEnabled ? await sendPushReminders(row.user_id, reminder) : false;
    const emailSent = preferences.emailFallbackEnabled && !pushSent ? await sendEmailReminder(user, reminder) : false;
    results.push({ userId: row.user_id, kind: reminder.kind, pushSent, emailSent });
  }

  return results;
}

export function startReminderScheduler() {
  const run = () => {
    dispatchDueReminders().catch(error => {
      console.error('Reminder dispatch failed:', error);
    });
  };
  run();
  const intervalMs = SCAN_INTERVAL_MINUTES * 60 * 1000;
  const timer = setInterval(() => {
    run();
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
