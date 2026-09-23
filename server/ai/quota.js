import { AsyncLocalStorage } from 'node:async_hooks';
import { db, nowIso } from '../db.js';
import { getLearningBootstrap } from '../learning.js';
import { aiError, validId } from './storage.js';

export const requestScope = new AsyncLocalStorage();
export const TASK_WEIGHTS = Object.freeze({ chat: 1, tutor: 1, explain: 1, quiz: 1, 'study-explain': 1, 'study-practice': 2, 'study-plan': 3, 'chapter-synthesis': 3, 'truth-report': 3 });
export const DEFAULT_TIERS = [[1, 20, 120], [5, 30, 200], [10, 45, 320], [20, 65, 480], [40, 90, 700]];
const windows = [['short', 5 * 3600000, 1], ['week', 7 * 86400000, 2]];

export function quotaLevel(userId) {
  const learning = getLearningBootstrap(userId);
  const daily = new Map();
  const seen = new Set();
  function add(key, date, points) {
    if (seen.has(key)) return;
    const parsed = new Date(date);
    if (!Number.isFinite(parsed.getTime()) || parsed.getTime() > Date.now()) return;
    seen.add(key);
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(parsed);
    daily.set(day, Math.min(200, (daily.get(day) || 0) + points));
  }
  const progress = new Map(learning.progress.map(p => [p.knowledgePointId, p]));
  const points = new Map(learning.knowledgePoints.map(kp => [kp.id, { ...kp, ...progress.get(kp.id) }]));
  for (const p of learning.progress) if (!points.has(p.knowledgePointId)) points.set(p.knowledgePointId, p);
  for (const [id, kp] of points) {
    for (const record of kp.studyRecords || []) add(`s:${id}:${record.id || record.date}`, record.date, 3);
    for (const record of kp.quizRecords || []) add(`q:${id}:${record.id || record.date}`, record.date, 3);
    if (kp.masteredAt || kp.proficiency === 'master') add(`m:${id}`, kp.masteredAt || kp.lastReviewedAt || kp.createdAt, 10);
    for (const record of kp.quizSessions || []) add(`session:${record.id}`, record.completedAt, Math.max(0, Math.min(200, Number(record.totalQuestions) * 3 || 0)));
  }
  const assets = db.prepare('SELECT experience FROM user_assets WHERE user_id = ?').get(userId);
  const total = [...daily.values()].reduce((a, b) => a + b, 0) + Math.max(0, Number(assets?.experience) || 0);
  let level = 1, threshold = 0;
  while (level < 10000) {
    const next = threshold + Math.round(80 + level * 40 + Math.pow(level, 1.35) * 18);
    if (total < next) break;
    threshold = next; level += 1;
  }
  return level;
}
function tiers() {
  if (!process.env.AI_QUOTA_TIERS) return DEFAULT_TIERS;
  const value = JSON.parse(process.env.AI_QUOTA_TIERS);
  if (!Array.isArray(value) || value[0]?.[0] !== 1 || value.some((v, i) => v.length !== 3 || v.some(n => !Number.isInteger(n) || n < 1) || (i && v[0] <= value[i - 1][0]))) throw new Error('Invalid AI_QUOTA_TIERS');
  return value;
}
export function quotaStatus(userId, now = Date.now()) {
  const level = quotaLevel(userId);
  const tier = tiers().filter(t => t[0] <= level).at(-1);
  const result = { level, weights: TASK_WEIGHTS };
  for (const [key, duration, index] of windows) {
    const events = db.prepare("SELECT points, created_at FROM ai_usage_events WHERE user_id = ? AND mode = 'platform' AND status IN ('reserved','complete','interrupted') AND created_at > ? ORDER BY created_at")
      .all(userId, new Date(now - duration).toISOString());
    const used = events.reduce((sum, event) => sum + event.points, 0);
    result[key] = { limit: tier[index], used, remaining: Math.max(0, tier[index] - used), restoresAt: events[0] ? new Date(Date.parse(events[0].created_at) + duration).toISOString() : null };
  }
  return result;
}
export function reserveUsage(userId, requestId, task, mode, fingerprint = '') {
  validId(requestId);
  const weight = TASK_WEIGHTS[task];
  if (!weight) throw aiError('UNKNOWN_TASK', '不支持的 AI 任务');
  db.exec('BEGIN IMMEDIATE');
  try {
    const existing = db.prepare('SELECT * FROM ai_usage_events WHERE request_id = ?').get(requestId);
    if (existing) {
      if (existing.user_id !== userId || existing.task !== task || (existing.fingerprint || '') !== fingerprint) throw aiError('REQUEST_CONFLICT', '请求标识冲突', 409);
      if (existing.status === 'complete' && existing.response) { db.exec('COMMIT'); return { cached: JSON.parse(existing.response) }; }
      throw aiError('REQUEST_CONFLICT', '该请求已处理，请刷新记录或重新发送', 409);
    }
    // Expired reservations can be left behind by a process crash. Keep their cost counted.
    db.prepare("UPDATE ai_usage_events SET status = 'interrupted', updated_at = ? WHERE status = 'reserved' AND updated_at < ?")
      .run(nowIso(), new Date(Date.now() - 5 * 60000).toISOString());
    const active = db.prepare("SELECT COUNT(*) AS n FROM ai_usage_events WHERE user_id = ? AND status = 'reserved'").get(userId).n;
    const recent = db.prepare('SELECT COUNT(*) AS n FROM ai_usage_events WHERE user_id = ? AND created_at > ?').get(userId, new Date(Date.now() - 5 * 60000).toISOString()).n;
    if (active >= 3 || recent >= 60) throw aiError('RATE_LIMITED', '请求较多，请稍后再试', 429);
    const quota = quotaStatus(userId);
    if (mode === 'platform' && (quota.short.remaining < weight || quota.week.remaining < weight)) throw aiError('QUOTA_EXHAUSTED', '本次 AI 额度不足，可等待恢复或使用自定义 AI', 429, { quota });
    db.prepare('INSERT INTO ai_usage_events(request_id,user_id,task,mode,points,status,created_at,updated_at,fingerprint) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(requestId, userId, task, mode, mode === 'platform' ? weight : 0, 'reserved', nowIso(), nowIso(), fingerprint);
    db.exec('COMMIT');
    return { requestId, accepted: false, output: false, started: Date.now(), signal: null };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function finishUsage(scope, response, error) {
  const status = !error ? 'complete' : scope.accepted ? 'interrupted' : 'refunded';
  db.prepare('UPDATE ai_usage_events SET status=?, response=?, error_code=?, duration_ms=?, updated_at=? WHERE request_id=?')
    .run(status, response ? JSON.stringify(response) : null, error?.code || (error ? 'AI_UNAVAILABLE' : null), Date.now() - scope.started, nowIso(), scope.requestId);
  console.info(JSON.stringify({ event: 'ai_request', requestId: scope.requestId, status, durationMs: Date.now() - scope.started, code: error?.code }));
}
