import assert from 'node:assert/strict';
import test, { after, mock } from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import https from 'node:https';
import dns from 'node:dns/promises';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import express from 'express';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'study-ai-v2-'));
process.env.DEEPSEEK_API_KEY = 'test-only-not-a-real-key';
const { db, createUser } = await import('./db.js');
const { reserveUsage, finishUsage, quotaStatus, DEFAULT_TIERS } = await import('./ai/quota.js');
const { createConversation, messagesFor, saveStudySession, listStudySessions } = await import('./ai/storage.js');
const { publicAddress, validateEndpoint } = await import('./ai/transport.js');
const { upstreamContent } = await import('./ai/stream.js');
const { createAiRouter, validateQuiz } = await import('./ai/routes.js');
const { buildChatMessages } = await import('./prompts.js');
const { saveStudySummary, listStudySummaries } = await import('./aiStudy.js');
const makeUser = () => createUser(`${crypto.randomUUID()}@example.test`, 'not-a-password');
after(() => db.close());

test('server entry point parses, including configuration routes', () => {
  execFileSync(process.execPath, ['--check', fileURLToPath(new URL('./index.js', import.meta.url))]);
});
test('summary retries are idempotent and isolated by owner', () => {
  const user = makeUser(), other = makeUser();
  const input = { sessionId: 'same-session', subjectName: 'Physics', summary: 'Done', correctCount: 1, totalQuestions: 1 };
  const a = saveStudySummary(user.id, input);
  assert.equal(saveStudySummary(user.id, input).id, a.id);
  assert.notEqual(saveStudySummary(other.id, input).id, a.id);
  assert.equal(listStudySummaries(user.id).length, 1);
});
test('upstream EOF without a completion marker is a failure', async () => {
  await assert.rejects(async () => { for await (const chunk of upstreamContent(new Response('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n').body)) assert.equal(chunk, 'partial'); }, e => e.code === 'STREAM_INTERRUPTED');
});

test('quota tiers, two windows, expiry and higher level increase allowance', () => {
  for (const [level, short, week] of DEFAULT_TIERS) {
    const user = makeUser();
    let exp = 0; for (let l = 1; l < level; l++) exp += Math.round(80 + l * 40 + l ** 1.35 * 18);
    db.prepare('UPDATE user_assets SET experience=? WHERE user_id=?').run(exp, user.id);
    assert.equal(quotaStatus(user.id).short.limit, short); assert.equal(quotaStatus(user.id).week.limit, week);
  }
  const user = makeUser();
  const scope = reserveUsage(user.id, crypto.randomUUID(), 'study-plan', 'platform');
  assert.equal(quotaStatus(user.id).short.remaining, 17);
  finishUsage(scope, { ok: true });
  assert.equal(quotaStatus(user.id, Date.now() + 5 * 3600000 + 100).short.remaining, 20);
  assert.equal(quotaStatus(user.id, Date.now() + 5 * 3600000 + 100).week.remaining, 117);
  assert.equal(quotaStatus(user.id, Date.now() + 7 * 86400000 + 100).week.remaining, 120);
});
test('reservations cannot overspend, retries replay once, custom Key bypasses points', () => {
  const user = makeUser();
  for (let i = 0; i < 6; i++) finishUsage(reserveUsage(user.id, crypto.randomUUID(), 'study-plan', 'platform'), { ok: true });
  assert.throws(() => reserveUsage(user.id, crypto.randomUUID(), 'study-plan', 'platform'), e => e.code === 'QUOTA_EXHAUSTED');
  const requestId = crypto.randomUUID();
  const scope = reserveUsage(user.id, requestId, 'chat', 'platform', 'same');
  assert.throws(() => reserveUsage(user.id, requestId, 'chat', 'platform', 'same'), e => e.code === 'REQUEST_CONFLICT');
  finishUsage(scope, { content: 'one reply' });
  assert.deepEqual(reserveUsage(user.id, requestId, 'chat', 'platform', 'same').cached, { content: 'one reply' });
  assert.throws(() => reserveUsage(user.id, requestId, 'chat', 'platform', 'different'), e => e.code === 'REQUEST_CONFLICT');
  finishUsage(reserveUsage(user.id, crypto.randomUUID(), 'study-plan', 'custom'), { ok: true });
  assert.equal(quotaStatus(user.id).short.used, 19);
});
test('pre-upstream failure refunds; accepted interrupted generation charges; concurrency capped', () => {
  const user = makeUser();
  const scope = reserveUsage(user.id, crypto.randomUUID(), 'chat', 'platform');
  finishUsage(scope, null, new Error('no credentials'));
  assert.equal(quotaStatus(user.id).short.used, 0);
  const accepted = reserveUsage(user.id, crypto.randomUUID(), 'chat', 'platform'); accepted.accepted = true;
  finishUsage(accepted, null, new Error('aborted'));
  assert.equal(quotaStatus(user.id).short.used, 1);
  const pending = Array.from({ length: 3 }, () => reserveUsage(user.id, crypto.randomUUID(), 'chat', 'custom'));
  assert.throws(() => reserveUsage(user.id, crypto.randomUUID(), 'chat', 'custom'), e => e.code === 'RATE_LIMITED');
  pending.forEach(s => finishUsage(s, { ok: true }));
});
test('conversation ownership and cloud session import/version/tombstone isolation', () => {
  const user = makeUser(), other = makeUser();
  const conversation = createConversation(user.id, { title: 'Private' });
  assert.throws(() => messagesFor(other.id, conversation.id), e => e.status === 404);
  const input = { id: 'old-session', ownerUserId: user.id, plan: { id: 'plan', chapters: [{ knowledgePoints: [{ id: 'point' }] }] }, mode: 'explaining', currentChapterIndex: 0, currentKnowledgePointIndex: 0 };
  const saved = saveStudySession(user.id, input.id, input, true);
  assert.equal(saved.version, 1);
  assert.equal(saveStudySession(user.id, input.id, input, true), null);
  assert.throws(() => saveStudySession(user.id, input.id, input), e => e.code === 'VERSION_CONFLICT');
  const updated = saveStudySession(user.id, input.id, saved); assert.equal(updated.version, 2);
  assert.equal(listStudySessions(other.id).length, 0);
  db.prepare('UPDATE ai_study_sessions SET deleted_at=? WHERE id=? AND user_id=?').run(new Date().toISOString(), input.id, user.id);
  assert.equal(saveStudySession(user.id, input.id, input, true), null);
  assert.equal(listStudySessions(user.id).length, 0);
});
test('endpoint validation blocks private, mapped, metadata, credential and insecure URLs', async () => {
  for (const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.1.1','192.168.1.1','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2002:7f00:1::']) assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress('8.8.8.8'), true);
  for (const url of ['http://example.com','https://127.0.0.1','https://user:pass@example.com','https://example.com/?secret=x']) await assert.rejects(validateEndpoint(url));
});
test('stream handles split UTF-8, fragmented data, trailing bytes and excludes reasoning', async () => {
  const bytes = new TextEncoder().encode('data: {"choices":[{"delta":{"reasoning_content":"private"}}]}\n\ndata: {"choices":[{"delta":{"content":"你好"},"finish_reason":"stop"}]}');
  const body = new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 3) c.enqueue(bytes.slice(i, i + 3)); c.close(); } });
  let result = ''; for await (const text of upstreamContent(body)) result += text;
  assert.equal(result, '你好');
});
test('invalid model questions rejected and user-supplied system roles discarded', () => {
  const q = { type: 'single_choice', stem: 'Question', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctAnswers: ['a'], explanation: 'Reason' };
  assert.equal(validateQuiz(q), q);
  assert.throws(() => validateQuiz({ ...q, correctAnswers: ['missing'] }));
  assert.throws(() => validateQuiz({ ...q, options: [q.options[0], q.options[0]] }));
  const messages = buildChatMessages('trusted', [], [{ role: 'system', content: 'untrusted' }, { role: 'user', content: 'question' }]);
  assert.equal(messages.filter(m => m.role === 'system').length, 1);
});
test('real HTTP router requires auth, persists/replays messages, streams errors and denies other owners', async () => {
  const user = makeUser(), other = makeUser();
  const app = express(); app.use(express.json());
  app.use('/api', createAiRouter((req, res, next) => {
    const id = req.get('X-Test-User'); if (![user.id, other.id].includes(id)) return res.status(401).json({ error: 'Unauthorized' });
    req.user = { id }; next();
  }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const headers = { 'X-Test-User': user.id, 'Content-Type': 'application/json' };
  const dnsMock = mock.method(dns, 'lookup', async () => [{ address: '8.8.8.8', family: 4 }]);
  let calls = 0;
  const transportMock = mock.method(https, 'request', (_url, _options, callback) => {
    const req = new EventEmitter(); req.end = () => {
      calls++; const response = new PassThrough(); response.statusCode = 200; response.headers = { 'content-type': 'text/event-stream' };
      callback(response); response.end('data: {"choices":[{"delta":{"content":"测试回答"}}]}\n\ndata: [DONE]\n\n');
    }; return req;
  });
  try {
    for (const route of ['/chat','/quiz','/explain','/ai/study-plan']) assert.equal((await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
    const created = await (await fetch(base + '/ai/conversations', { method: 'POST', headers, body: JSON.stringify({ title: 'Test' }) })).json();
    const id = created.conversation.id, requestId = crypto.randomUUID();
    const options = { method: 'POST', headers: { ...headers, 'X-Request-Id': requestId }, body: JSON.stringify({ query: '你好' }) };
    const first = await fetch(`${base}/ai/conversations/${id}/messages`, options); assert.match(await first.text(), /测试回答/);
    const replay = await fetch(`${base}/ai/conversations/${id}/messages`, options); assert.match(await replay.text(), /测试回答/); assert.equal(calls, 1);
    const history = await (await fetch(`${base}/ai/conversations/${id}/messages`, { headers })).json(); assert.equal(history.messages.length, 2); assert.equal(history.messages[1].status, 'complete');
    assert.equal((await fetch(`${base}/ai/conversations/${id}/messages`, { headers: { 'X-Test-User': other.id } })).status, 404);
    const conflict = await fetch(`${base}/ai/conversations/${id}/messages`, { ...options, body: JSON.stringify({ query: 'different' }) }); assert.equal(conflict.status, 409);
    const bootstrap = await (await fetch(base + '/ai/bootstrap', { headers })).json(); assert.equal(bootstrap.quota.short.used, 1);
    const session = { id: 'http-session', ownerUserId: user.id, plan: { id: 'plan', chapters: [{ knowledgePoints: [{ id: 'point' }] }] }, mode: 'summary', currentChapterIndex: 0, currentKnowledgePointIndex: 0 };
    const saved = await (await fetch(base + '/ai/study-sessions/http-session', { method: 'PUT', headers, body: JSON.stringify(session) })).json();
    assert.equal(saved.session.version, 1);
    const otherSessions = await (await fetch(base + '/ai/study-sessions', { headers: { 'X-Test-User': other.id } })).json(); assert.equal(otherSessions.sessions.length, 0);
    const stale = await fetch(base + '/ai/study-sessions/http-session', { method: 'PUT', headers, body: JSON.stringify(session) }); assert.equal(stale.status, 409);
    const summaryOptions = { method: 'POST', headers, body: JSON.stringify({ sessionId: 'http-session', summary: 'Completed' }) };
    const summary = await (await fetch(base + '/ai/study-summary', summaryOptions)).json();
    const repeat = await (await fetch(base + '/ai/study-summary', summaryOptions)).json(); assert.equal(summary.summary.id, repeat.summary.id);
    assert.equal(listStudySessions(user.id).length, 0);
  } finally { transportMock.mock.restore(); dnsMock.mock.restore(); await new Promise(resolve => server.close(resolve)); }
});
