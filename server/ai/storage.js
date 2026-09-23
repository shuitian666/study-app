import crypto from 'node:crypto';
import { db, nowIso } from '../db.js';

db.exec(`
CREATE TABLE IF NOT EXISTS ai_conversations (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, title TEXT NOT NULL, context TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id, updated_at);
CREATE TABLE IF NOT EXISTS ai_messages (
 id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
 role TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL, request_id TEXT,
 created_at TEXT NOT NULL, UNIQUE(conversation_id, request_id, role)
);
CREATE TABLE IF NOT EXISTS ai_study_sessions (
 id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 payload TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL,
 deleted_at TEXT, PRIMARY KEY(user_id, id)
);
CREATE TABLE IF NOT EXISTS ai_usage_events (
 request_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 task TEXT NOT NULL, mode TEXT NOT NULL, points INTEGER NOT NULL,
 status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 response TEXT, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
 error_code TEXT, duration_ms INTEGER, fingerprint TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_time ON ai_usage_events(user_id, created_at);
`);
if (!db.prepare('PRAGMA table_info(ai_usage_events)').all().some(column => column.name === 'fingerprint')) db.exec('ALTER TABLE ai_usage_events ADD COLUMN fingerprint TEXT');

export function aiError(code, message, status = 400, extra = {}) {
  return Object.assign(new Error(message), { code, status, ...extra });
}
export function errorBody(error, requestId) {
  const status = error.status || 502;
  const message = status >= 500 ? 'AI 服务暂时不可用，请稍后重试。' : error.message;
  return { code: error.code || 'AI_UNAVAILABLE', message, error: message, requestId,
    retryable: status >= 500 || status === 429, ...(error.quota ? { quota: error.quota } : {}) };
}
export function validId(value) {
  if (typeof value !== 'string' || !/^[\w:-]{1,160}$/.test(value)) throw aiError('INVALID_ID', '记录标识无效');
  return value;
}
export function ownedConversation(userId, id) {
  const row = db.prepare('SELECT * FROM ai_conversations WHERE id = ? AND user_id = ?').get(validId(id), userId);
  if (!row) throw aiError('NOT_FOUND', '会话不存在', 404);
  return { id: row.id, kind: row.kind, title: row.title, context: JSON.parse(row.context), createdAt: row.created_at, updatedAt: row.updated_at };
}
export function listConversations(userId) {
  return db.prepare('SELECT id, kind, title, created_at AS createdAt, updated_at AS updatedAt FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100').all(userId);
}
export function createConversation(userId, input = {}) {
  const kind = ['general', 'contextual_help', 'study_tutor'].includes(input.kind) ? input.kind : 'general';
  const id = input.id ? validId(input.id) : crypto.randomUUID();
  const existing = db.prepare('SELECT user_id FROM ai_conversations WHERE id = ?').get(id);
  if (existing) return ownedConversation(userId, id);
  const context = JSON.stringify(input.context || {});
  if (context.length > 20000) throw aiError('CONTEXT_TOO_LARGE', '题目上下文过长');
  db.prepare('INSERT INTO ai_conversations VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, userId, kind, String(input.title || '新对话').slice(0, 80), context, nowIso(), nowIso());
  return ownedConversation(userId, id);
}
export function messagesFor(userId, id, before) {
  ownedConversation(userId, id);
  db.prepare("UPDATE ai_messages SET status='interrupted' WHERE conversation_id=? AND status='streaming' AND NOT EXISTS (SELECT 1 FROM ai_usage_events u WHERE u.request_id=ai_messages.request_id AND u.status='reserved' AND u.updated_at > ?)").run(id, new Date(Date.now() - 5 * 60000).toISOString());
  const cursor = before ? Number(before) : Number.MAX_SAFE_INTEGER;
  return db.prepare('SELECT rowid AS cursor, id, role, content, status, request_id AS requestId, created_at AS createdAt FROM ai_messages WHERE conversation_id = ? AND rowid < ? ORDER BY rowid DESC LIMIT 100')
    .all(id, Number.isFinite(cursor) ? cursor : Number.MAX_SAFE_INTEGER).reverse();
}
export function appendMessage(id, role, content, requestId, status = 'complete') {
  const messageId = crypto.randomUUID();
  db.prepare('INSERT OR IGNORE INTO ai_messages VALUES (?, ?, ?, ?, ?, ?, ?)').run(messageId, id, role, content, status, requestId, nowIso());
  db.prepare('UPDATE ai_conversations SET updated_at = ? WHERE id = ?').run(nowIso(), id);
  return messageId;
}
export function updateMessage(id, content, status) {
  db.prepare('UPDATE ai_messages SET content = ?, status = ? WHERE id = ?').run(content, status, id);
}
export function listStudySessions(userId) {
  return db.prepare('SELECT * FROM ai_study_sessions WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC').all(userId)
    .map(row => ({ ...JSON.parse(row.payload), ownerUserId: userId, version: row.version, updatedAt: row.updated_at }));
}
export function saveStudySession(userId, id, input, importing = false) {
  validId(id);
  if (!input?.plan?.id || !Array.isArray(input.plan.chapters) || !input.plan.chapters.length
      || !['planning', 'explaining', 'practice', 'chapter_review', 'summary'].includes(input.mode)
      || !Number.isInteger(input.currentChapterIndex) || input.currentChapterIndex < 0
      || input.currentChapterIndex >= input.plan.chapters.length
      || !Number.isInteger(input.currentKnowledgePointIndex) || input.currentKnowledgePointIndex < 0
      || input.currentKnowledgePointIndex >= (input.plan.chapters[input.currentChapterIndex]?.knowledgePoints?.length || 0)) {
    throw aiError('INVALID_SESSION', '学习进度格式无效');
  }
  const payload = JSON.stringify({ ...input, id, ownerUserId: userId });
  if (payload.length > 500000) throw aiError('SESSION_TOO_LARGE', '学习计划过长');
  db.exec('BEGIN IMMEDIATE');
  try {
    const current = db.prepare('SELECT * FROM ai_study_sessions WHERE user_id = ? AND id = ?').get(userId, id);
    if (importing && current) { db.exec('COMMIT'); return null; }
    if (current && (current.deleted_at || Number(input.version) !== current.version)) throw aiError('VERSION_CONFLICT', '另一设备已更新学习进度，请重新载入后继续', 409);
    const version = (current?.version || 0) + 1;
    const updatedAt = nowIso();
    db.prepare('INSERT INTO ai_study_sessions VALUES (?, ?, ?, ?, ?, NULL) ON CONFLICT(user_id, id) DO UPDATE SET payload = excluded.payload, version = excluded.version, updated_at = excluded.updated_at')
      .run(id, userId, payload, version, updatedAt);
    db.exec('COMMIT');
    return { ...input, id, ownerUserId: userId, version, updatedAt };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
