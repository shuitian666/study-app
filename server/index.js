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
  useInventoryItem,
} from './account.js';
import { sendVerificationEmail } from './mailer.js';
import { CHAT_SYSTEM_PROMPT, QUIZ_SYSTEM_PROMPT, buildChatMessages } from './prompts.js';
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

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS origin denied'));
  },
  credentials: true,
});
app.use('/api', corsMiddleware);
app.use(express.json({ limit: '1mb' }));

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

app.post('/api/chat', authOptional, aiLimiter, async (req, res) => {
  const { messages = [], knowledgeContext } = req.body;
  const fullMessages = buildChatMessages(CHAT_SYSTEM_PROMPT, knowledgeContext, messages);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const response = await chatCompletion(req.user?.id, fullMessages, { stream: true });
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
          const content = chunk.choices?.[0]?.delta?.content || '';
          if (content) res.write(`data: ${JSON.stringify({ content, done: false })}\n\n`);
        } catch {
          // Ignore partial chunks.
        }
      }
    }
    res.write(`data: ${JSON.stringify({ content: '', done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Chat error:', sanitizeError(err));
    res.write(`data: ${JSON.stringify({ error: sanitizeError(err), done: true })}\n\n`);
    res.end();
  }
});

app.post('/api/quiz', authOptional, aiLimiter, async (req, res) => {
  const { knowledgePointNames = [], subjectName = '' } = req.body;
  const messages = [
    { role: 'system', content: QUIZ_SYSTEM_PROMPT },
    { role: 'user', content: `Create one multiple-choice question for ${subjectName}. Knowledge points: ${knowledgePointNames.join(', ')}. Return JSON only.` },
  ];

  try {
    const response = await chatCompletion(req.user?.id, messages, { stream: false, temperature: 0.8 });
    const text = await extractContent(response);
    const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
    res.json({ question: JSON.parse(cleaned), mode: 'smart' });
  } catch (err) {
    console.error('Quiz error:', sanitizeError(err));
    res.json({ question: null, error: sanitizeError(err) });
  }
});

app.post('/api/explain', authOptional, aiLimiter, async (req, res) => {
  const { question, selectedAnswer, correctAnswer, knowledgePoint, subjectName } = req.body;
  const messages = [
    { role: 'system', content: 'You are a concise learning tutor. Explain the answer clearly.' },
    { role: 'user', content: JSON.stringify({ subjectName, knowledgePoint, question, selectedAnswer, correctAnswer }) },
  ];

  try {
    const response = await chatCompletion(req.user?.id, messages, { stream: false, temperature: 0.7 });
    res.json({ explanation: await extractContent(response) });
  } catch (err) {
    console.error('Explain error:', sanitizeError(err));
    res.json({ explanation: null, error: sanitizeError(err) });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: nowIso() });
});

const teams = new Map();
app.post('/api/team/create', (req, res) => {
  const teamId = `team-${Date.now()}`;
  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const team = { id: teamId, inviteCode, members: [], status: 'waiting', createdAt: nowIso(), todayCheckedIn: false };
  teams.set(teamId, team);
  res.json({ teamId, inviteCode, team });
});
app.get('/api/team/:teamId', (req, res) => res.json(teams.get(req.params.teamId) || null));

const PORT = process.env.PORT || 3001;
app.use(express.static(distDir));
app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
