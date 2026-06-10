import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, createUser, getUserByPhone, getUserById, nowIso } from './db.js';
import {
  buyShopItem,
  drawLotteryForUser,
  getAccountState,
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
  buildChapterSynthesis,
  buildStudyExplanation,
  buildStudyPlan,
  buildStudyPractice,
  listStudySummaries,
  saveStudySummary,
} from './aiStudy.js';

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

app.patch('/api/account/profile', requireAuth, (req, res) => {
  try {
    res.json(updateAccountProfile(req.user.id, req.body || {}));
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

app.post('/api/ai/study-plan', requireAuth, aiLimiter, (req, res) => {
  try {
    res.json({ plan: buildStudyPlan(req.body || {}) });
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/ai/study-explain', requireAuth, aiLimiter, (req, res) => {
  try {
    res.json(buildStudyExplanation(req.body || {}));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/ai/study-practice', requireAuth, aiLimiter, (req, res) => {
  try {
    res.json(buildStudyPractice(req.body || {}));
  } catch (err) {
    res.status(err.status || 500).json({ error: sanitizeError(err) });
  }
});

app.post('/api/ai/chapter-synthesis', requireAuth, aiLimiter, (req, res) => {
  try {
    res.json(buildChapterSynthesis(req.body || {}));
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
app.use(express.static(distDir));
app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
