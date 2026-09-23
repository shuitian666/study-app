import crypto from 'node:crypto';
import express from 'express';
import { db, nowIso } from '../db.js';
import { chatCompletion, extractContent, getAiConfigForUser, getAiConfigStatus } from '../providers.js';
import { buildChatMessages, buildQuizMessages, buildExplainMessages, CHAT_SYSTEM_PROMPT } from '../prompts.js';
import { buildStudyTutorMessages, generateStudyPlan, generateStudyExplanation, generateStudyPractice, generateChapterSynthesis, listStudySummaries, saveStudySummary } from '../aiStudy.js';
import { getTruthStatus, createTruthReport } from '../truth.js';
import { createConversation, listConversations, ownedConversation, messagesFor, appendMessage, updateMessage, listStudySessions, saveStudySession, aiError, errorBody, validId } from './storage.js';
import { quotaStatus, reserveUsage, finishUsage, requestScope } from './quota.js';
import { writeSse, upstreamContent } from './stream.js';

function jsonRoute(handler) {
  return async (req, res) => {
    try { res.json(await handler(req)); }
    catch (error) { res.status(error.status || 502).json(errorBody(error, req.get('X-Request-Id'))); }
  };
}
function taskRoute(task, handler, stream = false) {
  return async (req, res) => {
    const requestId = req.get('X-Request-Id') || crypto.randomUUID();
    let scope;
    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', cancel);
    try {
      const fingerprint = crypto.createHash('sha256').update(req.originalUrl + JSON.stringify(req.body || {})).digest('hex');
      scope = reserveUsage(req.user.id, requestId, task, getAiConfigForUser(req.user.id).mode, fingerprint);
      if (scope.cached) {
        if (stream) {
          res.type('text/event-stream'); writeSse(res, { content: scope.cached.content, done: false, requestId });
          writeSse(res, { done: true, requestId }); res.end();
        } else res.json(scope.cached);
        return;
      }
      scope.signal = controller.signal;
      const response = await requestScope.run(scope, () => handler(req, res, requestId));
      finishUsage(scope, response);
      if (stream) { writeSse(res, { done: true, requestId, quota: quotaStatus(req.user.id) }); res.end(); }
      else res.json(response);
    } catch (error) {
      if (scope && !scope.cached) finishUsage(scope, null, error);
      const body = errorBody(error, requestId);
      if (res.headersSent) { writeSse(res, { ...body, done: true }); res.end(); }
      else res.status(error.status || 502).json(body);
    } finally { res.off('close', cancel); }
  };
}
async function sendStream(req, res, messages, requestId, conversationId) {
  let content = '', messageId;
  if (conversationId) messageId = appendMessage(conversationId, 'assistant', '', requestId, 'streaming');
  let lastSave = 0;
  try {
    const response = await chatCompletion(req.user.id, messages, { stream: true, maxTokens: 1800, temperature: 0.35 });
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
    writeSse(res, { requestId, messageId, done: false });
    for await (const chunk of upstreamContent(response.body)) {
      content += chunk;
      writeSse(res, { content: chunk, done: false, requestId });
      if (messageId && Date.now() - lastSave > 750) { updateMessage(messageId, content, 'streaming'); lastSave = Date.now(); }
    }
    if (!content.trim()) throw aiError('EMPTY_RESPONSE', 'AI 未返回内容', 502);
    if (messageId) updateMessage(messageId, content, 'complete');
    return { content, messageId };
  } catch (error) {
    if (messageId) updateMessage(messageId, content, requestScope.getStore()?.signal?.aborted ? 'cancelled' : content ? 'interrupted' : 'failed');
    throw error;
  }
}
export function validateQuiz(question) {
  if (!question || !['single_choice','multi_choice','true_false'].includes(question.type)
      || typeof question.stem !== 'string' || !question.stem.trim() || !Array.isArray(question.options)
      || question.options.length < 2 || question.options.length > 6
      || question.options.some(o => typeof o.id !== 'string' || !o.id || typeof o.text !== 'string' || !o.text.trim())
      || new Set(question.options.map(o => o.id)).size !== question.options.length
      || !Array.isArray(question.correctAnswers) || !question.correctAnswers.length
      || question.correctAnswers.some(a => !question.options.some(o => o.id === a))
      || (question.type !== 'multi_choice' && question.correctAnswers.length !== 1)
      || typeof question.explanation !== 'string' || !question.explanation.trim()) throw aiError('INVALID_OUTPUT', 'AI 题目格式无效，请重试', 502);
  return question;
}
export function createAiRouter(requireAuth) {
  const router = express.Router();
  router.use(['/ai', '/chat', '/quiz', '/explain'], requireAuth);
  router.get('/ai/quota', jsonRoute(req => quotaStatus(req.user.id)));
  router.get('/ai/bootstrap', jsonRoute(req => ({ enabled: process.env.AI_V2_ENABLED !== 'false', config: getAiConfigStatus(req.user.id), quota: quotaStatus(req.user.id), conversations: listConversations(req.user.id), sessions: listStudySessions(req.user.id), summaries: listStudySummaries(req.user.id), truth: getTruthStatus(req.user) })));
  router.get('/ai/conversations', jsonRoute(req => ({ conversations: listConversations(req.user.id) })));
  router.post('/ai/conversations', jsonRoute(req => ({ conversation: createConversation(req.user.id, req.body) })));
  router.get('/ai/conversations/:id', jsonRoute(req => ({ conversation: ownedConversation(req.user.id, req.params.id) })));
  router.delete('/ai/conversations/:id', jsonRoute(req => {
    ownedConversation(req.user.id, req.params.id);
    db.prepare('DELETE FROM ai_conversations WHERE id=? AND user_id=?').run(req.params.id, req.user.id); return { ok: true };
  }));
  router.get('/ai/conversations/:id/messages', jsonRoute(req => ({ messages: messagesFor(req.user.id, req.params.id, req.query.before) })));
  router.post('/ai/conversations/:id/messages', taskRoute('chat', async (req, res, requestId) => {
    const conversation = ownedConversation(req.user.id, req.params.id);
    const active = db.prepare("SELECT 1 FROM ai_messages m JOIN ai_usage_events u ON u.request_id=m.request_id WHERE m.conversation_id=? AND m.status='streaming' AND u.status='reserved'").get(conversation.id);
    if (active) throw aiError('CONVERSATION_BUSY', '此对话正在生成回答，请稍后继续', 409);
    const query = String(req.body.query || '').trim();
    if (!query || query.length > 8000) throw aiError('INVALID_QUERY', '请输入 1–8000 字的问题');
    const history = messagesFor(req.user.id, conversation.id).filter(m => m.status === 'complete').slice(-12);
    const context = { ...conversation.context, ...(req.body.context || {}) };
    if (JSON.stringify(context).length > 20000) throw aiError('CONTEXT_TOO_LARGE', '题目上下文过长');
    const messages = conversation.kind === 'general'
      ? buildChatMessages(CHAT_SYSTEM_PROMPT, [], [...history, { role: 'user', content: query }], req.body.learningContext)
      : buildStudyTutorMessages({ query, context, history });
    appendMessage(conversation.id, 'user', query, requestId);
    db.prepare('UPDATE ai_conversations SET context=? WHERE id=?').run(JSON.stringify(context), conversation.id);
    return sendStream(req, res, messages, requestId, conversation.id);
  }, true));
  router.get('/ai/study-sessions', jsonRoute(req => ({ sessions: listStudySessions(req.user.id) })));
  router.post('/ai/study-sessions/import', jsonRoute(req => {
    if (!Array.isArray(req.body.sessions) || req.body.sessions.length > 100) throw aiError('INVALID_IMPORT', '每次最多导入 100 个学习计划');
    for (const session of req.body.sessions) {
      if (session.ownerUserId !== req.user.id) throw aiError('OWNER_MISMATCH', '不能导入其他账号的计划', 403);
      saveStudySession(req.user.id, session.id, session, true);
    }
    return { sessions: listStudySessions(req.user.id) };
  }));
  router.get('/ai/study-sessions/:id', jsonRoute(req => {
    const session = listStudySessions(req.user.id).find(s => s.id === req.params.id);
    if (!session) throw aiError('NOT_FOUND', '学习计划不存在', 404); return { session };
  }));
  router.put('/ai/study-sessions/:id', jsonRoute(req => ({ session: saveStudySession(req.user.id, req.params.id, req.body) })));
  router.delete('/ai/study-sessions/:id', jsonRoute(req => {
    validId(req.params.id);
    const result = db.prepare('UPDATE ai_study_sessions SET deleted_at=?, version=version+1 WHERE id=? AND user_id=? AND version=? AND deleted_at IS NULL')
      .run(nowIso(), req.params.id, req.user.id, Number(req.query.version));
    if (!result.changes) throw aiError('VERSION_CONFLICT', '学习计划已更新，请重新载入', 409); return { ok: true };
  }));
  router.post('/chat', taskRoute('chat', (req, res, id) => sendStream(req, res, buildChatMessages(CHAT_SYSTEM_PROMPT, req.body.knowledgeContext, req.body.messages, req.body.learningContext), id), true));
  router.post('/ai/study-tutor', taskRoute('tutor', (req, res, id) => sendStream(req, res, buildStudyTutorMessages(req.body), id), true));
  router.post('/quiz', taskRoute('quiz', async req => {
    const input = req.body || {};
    const candidates = Array.isArray(input.knowledgePoints) && input.knowledgePoints.length ? input.knowledgePoints : (Array.isArray(input.knowledgePointNames) ? input.knowledgePointNames : []).map(name => ({ name }));
    const messages = buildQuizMessages({ ...input, knowledgePoints: candidates });
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await chatCompletion(req.user.id, messages, { maxTokens: 1800 });
      const text = await extractContent(response);
      try {
        const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
        const question = validateQuiz(parsed.question || parsed);
        return { question, selectedKnowledgePoint: candidates.find(k => k.name === parsed.selectedKnowledgePoint)?.name || candidates[0]?.name, mode: 'smart' };
      } catch { if (attempt === 1) throw aiError('INVALID_OUTPUT', 'AI 题目格式无效，请重试', 502); }
    }
  }));
  router.post('/explain', taskRoute('explain', async req => {
    const explanation = await extractContent(await chatCompletion(req.user.id, buildExplainMessages(req.body), { maxTokens: 1600 }));
    if (!explanation) throw aiError('EMPTY_RESPONSE', 'AI 未返回解析', 502); return { explanation };
  }));
  router.post('/ai/study-plan', taskRoute('study-plan', async req => ({ plan: await generateStudyPlan(req.user.id, req.body) })));
  router.post('/ai/study-explain', taskRoute('study-explain', req => generateStudyExplanation(req.user.id, req.body)));
  router.post('/ai/study-practice', taskRoute('study-practice', req => generateStudyPractice(req.user.id, req.body)));
  router.post('/ai/chapter-synthesis', taskRoute('chapter-synthesis', req => generateChapterSynthesis(req.user.id, req.body)));
  router.post('/ai/study-summary', jsonRoute(req => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const summary = saveStudySummary(req.user.id, req.body);
      if (req.body.sessionId) db.prepare('UPDATE ai_study_sessions SET deleted_at=?, version=version+1 WHERE id=? AND user_id=? AND deleted_at IS NULL').run(nowIso(), req.body.sessionId, req.user.id);
      db.exec('COMMIT'); return { summary };
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }));
  router.get('/ai/study-summaries', jsonRoute(req => ({ summaries: listStudySummaries(req.user.id) })));
  router.post('/truth/reports', requireAuth, taskRoute('truth-report', async req => {
    if (!getTruthStatus(req.user).enabled) throw aiError('FORBIDDEN', '当前账号不可使用求真', 403);
    return { report: await createTruthReport(req.user.id, req.body) };
  }));
  return router;
}
