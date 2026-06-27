import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, createUser, getUserByPhone, getUserById, nowIso } from './db.js';
import {
  getAdminStatus,
  grantRole,
  requirePermission,
  revokeRole,
  searchAdminUsers,
} from './admin.js';
import {
  buyShopItem,
  claimLevelReward,
  drawLotteryForUser,
  getAccountState,
  grantKnowledgePointAcceleration,
  performCheckin,
  redeemCode,
  updateAccountProfile,
  useInventoryItem,
} from './account.js';
import { sendVerificationEmail } from './mailer.js';
import { CHAT_SYSTEM_PROMPT, buildChatMessages, buildExplainMessages, buildQuizMessages } from './prompts.js';
import { chatCompletion, extractContent, getAiConfigStatus } from './providers.js';
import {
  clearSessionCookie,
  encryptSecret,
  getSessionId,
  hashValue,
  hashPassword,
  randomCode,
  makeRateLimiter,
  sanitizeError,
  setSessionCookie,
  verifyPassword,
} from './security.js';
import {
  createTeamForUser,
  dissolveTeamForUser,
  getTeam,
  joinTeamForUser,
  updateTeamProgressForUser,
} from './team.js';
import {
  deleteLearningRecords,
  getLearningBootstrap,
  importLearningBatch,
  patchLearningProgress,
} from './learning.js';
import {
  buildStudyTutorMessages,
  generateChapterSynthesis,
  generateStudyExplanation,
  generateStudyPlan,
  generateStudyPractice,
  listStudySummaries,
  saveStudySummary,
} from './aiStudy.js';
import {
  createTruthAssets,
  createTruthReport,
  getTruthAssetFile,
  getTruthReport,
  getTruthStatus,
  listTruthAssets,
  listTruthReports,
  searchTruthAssets,
  setTruthAssetStatus,
  streamTruthReportPdf,
  truthModeEnabled,
  truthTempDir,
  updateTruthAsset,
} from './truth.js';
import {
  claimMailAttachment,
  createSystemMail,
  listAdminMails,
  markMailRead,
} from './mail.js';
import {
  deletePushSubscription,
  getReminderPreferences,
  getVapidPublicKey,
  savePushSubscription,
  startReminderScheduler,
  updateReminderPreferences,
} from './reminders.js';

const app = express();
const defaultDevOrigins = [
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const configuredOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const allowedOrigins = new Set([
  ...configuredOrigins,
  ...(process.env.NODE_ENV === 'production' ? [] : defaultDevOrigins),
]);
function isPrivateDevOrigin(origin) {
  if (process.env.NODE_ENV === 'production') return false;
  try {
    const url = new URL(origin);
    const isPrivateHost = /^10\./.test(url.hostname)
      || /^192\.168\./.test(url.hostname)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname);
    return url.protocol === 'http:' && isPrivateHost && ['3001', '5173'].includes(url.port);
  } catch {
    return false;
  }
}
const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.size === 0 || allowedOrigins.has(origin) || isPrivateDevOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin denied'));
  },
  credentials: true,
});
app.use('/api', corsMiddleware);
app.use(express.json({ limit: '10mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');
const truthUpload = multer({
  storage: multer.diskStorage({
    destination: truthTempDir,
    filename: (_req, _file, callback) => callback(null, `upload-${crypto.randomUUID()}.tmp`),
  }),
  limits: {
    files: 100,
    fileSize: 20 * 1024 * 1024,
  },
});

function makeSession(userId) {
  const sessionId = `ses_${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  db.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(sessionId, userId, expiresAt, nowIso());
  return sessionId;
}

function authOptional(req, _res, next) {
  const sessionId = getSessionId(req);
  if (!sessionId) return next();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > ?').get(sessionId, nowIso());
  if (!session) return next();
  const user = getUserById(session.user_id);
  if (user) req.user = user;
  return next();
}

function requireAuth(req, res, next) {
  authOptional(req, res, () => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    return next();
  });
}

function requireTruthEnabled(_req, res, next) {
  if (!truthModeEnabled()) return res.status(404).json({ error: 'Truth mode is disabled' });
  return next();
}

function publicUserPayload(user) {
  return getAccountState(user.id);
}

const authLimiter = makeRateLimiter({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: 'auth' });
const emailLimiter = makeRateLimiter({ windowMs: 15 * 60 * 1000, max: 5, keyPrefix: 'email' });
const aiLimiter = makeRateLimiter({ windowMs: 60 * 1000, max: 30, keyPrefix: 'ai' });

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function consumeEmailCode(email, code) {
  const row = db.prepare(`
    SELECT * FROM email_codes
    WHERE email = ? AND consumed_at IS NULL AND expires_at > ?
    ORDER BY created_at DESC LIMIT 1
  `).get(email, nowIso());
  if (!row || row.code_hash !== hashValue(code)) return false;
  db.prepare('UPDATE email_codes SET consumed_at = ? WHERE id = ?').run(nowIso(), row.id);
  return true;
}

app.post('/api/auth/email/send', emailLimiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });
  if (getUserByPhone(email)) return res.status(409).json({ error: 'Account already exists' });

  const code = randomCode();
  db.prepare(`
    INSERT INTO email_codes (id, email, code_hash, expires_at, ip, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    `emc_${crypto.randomUUID()}`,
    email,
    hashValue(code),
    new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    req.ip,
    nowIso(),
  );

  try {
    await sendVerificationEmail(email, code);
    res.json({ ok: true });
  } catch (err) {
    console.error('Email send error:', sanitizeError(err));
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.post('/api/auth/register', authLimiter, (req, res) => {
  const email = String(req.body.email || req.body.phone || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const code = String(req.body.code || '').trim();
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!consumeEmailCode(email, code)) return res.status(400).json({ error: 'Invalid verification code' });
  if (getUserByPhone(email)) return res.status(409).json({ error: 'Account already exists' });

  const user = createUser(email, hashPassword(password));
  const sessionId = makeSession(user.id);
  setSessionCookie(res, sessionId);
  return res.json(publicUserPayload(user));
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const email = String(req.body.email || req.body.phone || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = getUserByPhone(email);
  if (!user || !verifyPassword(password, user.password_hash || '')) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const sessionId = makeSession(user.id);
  setSessionCookie(res, sessionId);
  return res.json(publicUserPayload(user));
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(getSessionId(req));
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json(publicUserPayload(req.user));
});

app.get('/api/account/state', requireAuth, (req, res) => {
  res.json(getAccountState(req.user.id));
});

app.get('/api/account/mail', requireAuth, (req, res) => {
  res.json({ mail: getAccountState(req.user.id).mail });
});

app.post('/api/account/mail/:id/read', requireAuth, (req, res) => {
  try {
    res.json({ mail: markMailRead(req.user.id, req.params.id) });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/account/mail/:id/attachments/:attachment/claim', requireAuth, (req, res) => {
  try {
    const result = claimMailAttachment(req.user.id, req.params.id, req.params.attachment);
    res.json({ ...getAccountState(req.user.id), mailClaim: { claimed: result.claimed } });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.patch('/api/account/profile', requireAuth, (req, res) => {
  try {
    res.json(updateAccountProfile(req.user.id, req.body || {}));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.get('/api/admin/status', requireAuth, (req, res) => {
  res.json(getAdminStatus(req.user));
});

app.get('/api/admin/users', requireAuth, requirePermission('admin.users.view'), (req, res) => {
  try {
    res.json({ users: searchAdminUsers(req.query.query || req.query.q || '', req.query.limit) });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/admin/roles/grant', requireAuth, requirePermission('admin.roles.manage'), (req, res) => {
  try {
    res.json({ user: grantRole(req.user, req.body?.userId, req.body?.role) });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/admin/roles/revoke', requireAuth, requirePermission('admin.roles.manage'), (req, res) => {
  try {
    res.json({ user: revokeRole(req.user, req.body?.userId) });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.get('/api/admin/mail', requireAuth, requirePermission('mail.send'), (req, res) => {
  try {
    res.json({ mails: listAdminMails(req.user, req.query.limit) });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/admin/mail', requireAuth, requirePermission('mail.send'), (req, res) => {
  try {
    res.json(createSystemMail(req.user, req.body || {}));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.get('/api/learning/bootstrap', requireAuth, (req, res) => {
  try {
    res.json(getLearningBootstrap(req.user.id));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/learning/import-batch', requireAuth, (req, res) => {
  try {
    res.json(importLearningBatch(req.user.id, req.body || {}));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.patch('/api/learning/progress', requireAuth, (req, res) => {
  try {
    res.json(patchLearningProgress(req.user.id, req.body || {}));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/learning/delete', requireAuth, (req, res) => {
  try {
    res.json(deleteLearningRecords(req.user.id, req.body || {}));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/account/checkin', requireAuth, (req, res) => {
  try {
    res.json(performCheckin(req.user.id, { date: String(req.body.date || ''), type: 'normal' }));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/account/makeup-checkin', requireAuth, (req, res) => {
  try {
    res.json(performCheckin(req.user.id, { date: String(req.body.date || ''), type: 'makeup' }));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/account/shop/buy', requireAuth, (req, res) => {
  try {
    res.json(buyShopItem(req.user.id, String(req.body.itemId || '')));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/account/experience/knowledge-point', requireAuth, (req, res) => {
  try {
    res.json(grantKnowledgePointAcceleration(req.user.id, {
      knowledgePointId: req.body.knowledgePointId,
      learningExperience: req.body.learningExperience,
    }));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/account/level-rewards/claim', requireAuth, (req, res) => {
  try {
    res.json(claimLevelReward(req.user.id, {
      level: req.body.level,
      learningExperience: req.body.learningExperience,
    }));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/account/redeem', requireAuth, (req, res) => {
  try {
    res.json(redeemCode(req.user.id, String(req.body.code || '').trim()));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/account/lottery/draw', requireAuth, (req, res) => {
  try {
    const pool = req.body.pool === 'up' ? 'up' : 'regular';
    const count = Number(req.body.count) === 10 ? 10 : 1;
    res.json(drawLotteryForUser(req.user.id, pool, count));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/account/inventory/use', requireAuth, (req, res) => {
  try {
    res.json(useInventoryItem(req.user.id, String(req.body.itemId || '')));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.get('/api/ai/config', requireAuth, (req, res) => {
  res.json(getAiConfigStatus(req.user.id));
});

app.put('/api/ai/config', requireAuth, (req, res) => {
  const mode = req.body.mode === 'custom' ? 'custom' : 'platform';
  const baseUrl = String(req.body.baseUrl || '').trim();
  const model = String(req.body.model || '').trim();
  const apiKey = String(req.body.apiKey || '').trim();

  if (mode === 'custom' && (!baseUrl || !model)) {
    return res.status(400).json({ error: 'Base URL and model are required' });
  }

  const existing = db.prepare('SELECT encrypted_api_key FROM user_ai_configs WHERE user_id = ?').get(req.user.id);
  const encrypted = apiKey ? encryptSecret(apiKey) : existing?.encrypted_api_key || null;
  if (mode === 'custom' && !encrypted) {
    return res.status(400).json({ error: 'API key is required' });
  }

  db.prepare(`
    INSERT INTO user_ai_configs (user_id, mode, base_url, model, encrypted_api_key, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id)
    DO UPDATE SET mode = excluded.mode, base_url = excluded.base_url, model = excluded.model,
      encrypted_api_key = excluded.encrypted_api_key, updated_at = excluded.updated_at
  `).run(req.user.id, mode, mode === 'custom' ? baseUrl : null, mode === 'custom' ? model : null, mode === 'custom' ? encrypted : null, nowIso());

  res.json(getAiConfigStatus(req.user.id));
});

app.get('/api/reminders/preferences', requireAuth, (req, res) => {
  res.json({
    preferences: getReminderPreferences(req.user.id),
    vapidPublicKey: getVapidPublicKey(),
  });
});

app.patch('/api/reminders/preferences', requireAuth, (req, res) => {
  try {
    res.json({ preferences: updateReminderPreferences(req.user.id, req.body || {}) });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/reminders/push-subscription', requireAuth, (req, res) => {
  try {
    res.json({
      preferences: savePushSubscription(req.user.id, req.body?.subscription, req.get('user-agent') || ''),
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.delete('/api/reminders/push-subscription', requireAuth, (req, res) => {
  try {
    res.json({ preferences: deletePushSubscription(req.user.id, String(req.body?.endpoint || '')) });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.get('/api/models', authOptional, (_req, res) => {
  res.json({ providers: [{ name: 'server', available: true, models: ['platform', 'custom'] }] });
});

function extractStreamContent(chunk) {
  const choice = chunk?.choices?.[0];
  return choice?.delta?.content
    || choice?.message?.content
    || choice?.delta?.reasoning_content
    || choice?.text
    || '';
}

function writeSse(res, payload) {
  if (!res.writableEnded && !res.destroyed) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}

app.post('/api/chat', authOptional, aiLimiter, async (req, res) => {
  const { messages = [], knowledgeContext, learningContext } = req.body;
  const fullMessages = buildChatMessages(CHAT_SYSTEM_PROMPT, knowledgeContext, messages, learningContext);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const response = await chatCompletion(req.user?.id, fullMessages, { stream: true });
    if (!response.body) {
      throw new Error('AI upstream did not return a stream');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        if (payload === '[DONE]') continue;
        try {
          const chunk = JSON.parse(payload);
          const content = extractStreamContent(chunk);
          if (content) writeSse(res, { content, done: false });
        } catch {
          // Ignore partial chunks.
        }
      }
    }
    writeSse(res, { content: '', done: true });
    res.end();
  } catch (err) {
    console.error('Chat error:', sanitizeError(err));
    writeSse(res, { error: sanitizeError(err), done: true });
    res.end();
  }
});

app.post('/api/quiz', authOptional, aiLimiter, async (req, res) => {
  const { knowledgePointNames = [], knowledgePoints = [], subjectName = '', learningContext } = req.body;
  const candidates = Array.isArray(knowledgePoints) && knowledgePoints.length > 0
    ? knowledgePoints
    : knowledgePointNames.map(name => ({ name }));
  const messages = buildQuizMessages({ subjectName, knowledgePoints: candidates, learningContext });

  try {
    const response = await chatCompletion(req.user?.id, messages, { stream: false, temperature: 0.8 });
    const text = await extractContent(response);
    const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    const question = parsed.question || parsed;
    const candidateNames = new Set(candidates.map(item => String(item.name || '')).filter(Boolean));
    const selectedKnowledgePoint = candidateNames.has(parsed.selectedKnowledgePoint)
      ? parsed.selectedKnowledgePoint
      : candidates[0]?.name;
    res.json({ question, selectedKnowledgePoint, mode: 'smart' });
  } catch (err) {
    console.error('Quiz error:', sanitizeError(err));
    res.json({ question: null, error: sanitizeError(err) });
  }
});

app.post('/api/explain', authOptional, aiLimiter, async (req, res) => {
  const messages = buildExplainMessages(req.body || {});

  try {
    const response = await chatCompletion(req.user?.id, messages, { stream: false, temperature: 0.7 });
    res.json({ explanation: await extractContent(response) });
  } catch (err) {
    console.error('Explain error:', sanitizeError(err));
    res.json({ explanation: null, error: sanitizeError(err) });
  }
});

app.post('/api/ai/study-plan', requireAuth, aiLimiter, async (req, res) => {
  try {
    res.json({ plan: await generateStudyPlan(req.user.id, req.body || {}) });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/ai/study-explain', requireAuth, aiLimiter, async (req, res) => {
  try {
    res.json(await generateStudyExplanation(req.user.id, req.body || {}));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/ai/study-practice', requireAuth, aiLimiter, async (req, res) => {
  try {
    res.json(await generateStudyPractice(req.user.id, req.body || {}));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/ai/study-tutor', requireAuth, aiLimiter, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const messages = buildStudyTutorMessages(req.body || {});
    const response = await chatCompletion(req.user.id, messages, {
      stream: true,
      temperature: 0.35,
      maxTokens: 1800,
    });
    if (!response.body) throw new Error('AI upstream did not return a stream');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        if (payload === '[DONE]') continue;
        try {
          const content = extractStreamContent(JSON.parse(payload));
          if (content) writeSse(res, { content, done: false });
        } catch {
          // Ignore partial upstream chunks.
        }
      }
    }
    writeSse(res, { content: '', done: true });
    res.end();
  } catch (err) {
    console.error('Study tutor error:', sanitizeError(err));
    writeSse(res, { error: sanitizeError(err), done: true });
    res.end();
  }
});

app.post('/api/ai/chapter-synthesis', requireAuth, aiLimiter, async (req, res) => {
  try {
    res.json(await generateChapterSynthesis(req.user.id, req.body || {}));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/ai/study-summary', requireAuth, aiLimiter, (req, res) => {
  try {
    res.json({ summary: saveStudySummary(req.user.id, req.body || {}) });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.get('/api/ai/study-summaries', requireAuth, (req, res) => {
  try {
    res.json({ summaries: listStudySummaries(req.user.id) });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.get('/api/truth/status', requireAuth, (req, res) => {
  res.json(getTruthStatus(req.user));
});

app.post('/api/truth/search', requireAuth, requireTruthEnabled, (req, res) => {
  try {
    res.json(searchTruthAssets(req.body?.query, req.body?.filter));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.get('/api/truth/assets', requireAuth, requireTruthEnabled, requirePermission('truth.assets.edit'), (req, res) => {
  try {
    res.json({
      assets: listTruthAssets({
        status: req.query.status,
        limit: req.query.limit,
        offset: req.query.offset,
      }),
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post(
  '/api/truth/assets/upload',
  requireAuth,
  requireTruthEnabled,
  requirePermission('truth.assets.upload'),
  truthUpload.array('images', 100),
  async (req, res) => {
    try {
      const metadata = JSON.parse(String(req.body.metadata || '{}'));
      res.json(await createTruthAssets(req.user.id, req.files || [], metadata));
    } catch (err) {
      for (const file of req.files || []) {
        try {
          fs.rmSync(file.path, { force: true });
        } catch {
          // Cleanup is best-effort.
        }
      }
      res.status(err.status || 400).json({ error: sanitizeError(err) });
    }
  },
);

app.patch('/api/truth/assets/:id', requireAuth, requireTruthEnabled, requirePermission('truth.assets.edit'), (req, res) => {
  try {
    res.json({ asset: updateTruthAsset(req.params.id, req.body || {}) });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/truth/assets/:id/submit', requireAuth, requireTruthEnabled, requirePermission('truth.assets.submit'), (req, res) => {
  try {
    res.json({ asset: setTruthAssetStatus(req.params.id, 'pending') });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/truth/assets/:id/publish', requireAuth, requireTruthEnabled, requirePermission('truth.assets.publish'), (req, res) => {
  try {
    res.json({ asset: setTruthAssetStatus(req.params.id, 'published') });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/truth/assets/:id/archive', requireAuth, requireTruthEnabled, requirePermission('truth.assets.archive'), (req, res) => {
  try {
    res.json({ asset: setTruthAssetStatus(req.params.id, 'archived') });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

for (const variant of ['preview', 'original', 'download']) {
  app.get(`/api/truth/assets/:id/${variant}`, requireAuth, requireTruthEnabled, (req, res) => {
    try {
      const file = getTruthAssetFile(req.params.id, variant, req.user);
      res.setHeader('Cache-Control', variant === 'preview' ? 'private, max-age=3600' : 'private, no-store');
      if (variant === 'download') return res.download(file.filePath, file.downloadName);
      res.type(file.mimeType);
      if (variant === 'original') {
        res.setHeader('Content-Disposition', 'inline');
      }
      return res.sendFile(file.filePath);
    } catch (err) {
      return res.status(err.status || 500).json({ error: sanitizeError(err) });
    }
  });
}

app.post('/api/truth/reports', requireAuth, requireTruthEnabled, aiLimiter, async (req, res) => {
  try {
    res.json({ report: await createTruthReport(req.user.id, req.body || {}) });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.get('/api/truth/reports', requireAuth, requireTruthEnabled, (req, res) => {
  try {
    res.json({ reports: listTruthReports(req.user.id) });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.get('/api/truth/reports/:id', requireAuth, requireTruthEnabled, (req, res) => {
  try {
    res.json({ report: getTruthReport(req.user.id, req.params.id) });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.get('/api/truth/reports/:id/pdf', requireAuth, requireTruthEnabled, (req, res) => {
  try {
    streamTruthReportPdf(req.user.id, req.params.id, res);
  } catch (err) {
    if (!res.headersSent) res.status(err.status || 500).json({ error: sanitizeError(err) });
    else res.end();
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: nowIso() });
});

app.post('/api/team/create', requireAuth, (req, res) => {
  try {
    const team = createTeamForUser(req.user);
    res.json({ teamId: team.id, inviteCode: team.inviteCode, team });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/team/join', requireAuth, (req, res) => {
  try {
    res.json({ team: joinTeamForUser(req.body.inviteCode, req.user) });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/team/progress', requireAuth, (req, res) => {
  try {
    res.json({ team: updateTeamProgressForUser(req.body.teamId, req.user, req.body.progress || {}) });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/team/dissolve', requireAuth, (req, res) => {
  try {
    res.json(dissolveTeamForUser(req.body.teamId, req.user.id));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.get('/api/team/:teamId', requireAuth, (req, res) => {
  const team = getTeam(req.params.teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  return res.json(team);
});

const PORT = process.env.PORT || 3001;
app.use((err, req, res, next) => {
  if (!(err instanceof multer.MulterError)) return next(err);
  for (const file of req.files || []) {
    try {
      fs.rmSync(file.path, { force: true });
    } catch {
      // Cleanup is best-effort.
    }
  }
  const message = err.code === 'LIMIT_FILE_SIZE'
    ? '单张图片不能超过20MB'
    : err.code === 'LIMIT_FILE_COUNT'
      ? '单批最多上传100张图片'
      : '图片上传失败';
  return res.status(400).json({ error: message });
});
app.use(express.static(distDir));
app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
startReminderScheduler();
