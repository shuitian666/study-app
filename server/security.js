import crypto from 'node:crypto';

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || 'study_session';
const DAY_MS = 24 * 60 * 60 * 1000;

function getCookieOptions() {
  const sameSite = process.env.SESSION_COOKIE_SAMESITE || 'Lax';
  const secure = process.env.SESSION_COOKIE_SECURE === undefined
    ? process.env.NODE_ENV === 'production'
    : process.env.SESSION_COOKIE_SECURE === 'true';
  return {
    domain: process.env.SESSION_COOKIE_DOMAIN || '',
    sameSite,
    secure,
  };
}

export function hashValue(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash = '') {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === candidate.length && crypto.timingSafeEqual(expected, candidate);
}

export function randomCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}

export function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const index = part.indexOf('=');
        if (index === -1) return [part, ''];
        return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

export function getSessionId(req) {
  return parseCookies(req.headers.cookie || '')[SESSION_COOKIE] || '';
}

export function setSessionCookie(res, sessionId) {
  const { domain, sameSite, secure } = getCookieOptions();
  const maxAge = 30 * DAY_MS;
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${sameSite}`,
    `Max-Age=${Math.floor(maxAge / 1000)}`,
  ];
  if (domain) parts.push(`Domain=${domain}`);
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res) {
  const { domain, sameSite, secure } = getCookieOptions();
  const parts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    `SameSite=${sameSite}`,
    'Max-Age=0',
  ];
  if (domain) parts.push(`Domain=${domain}`);
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function encryptionKey() {
  const raw = process.env.AI_CONFIG_ENCRYPTION_KEY || 'dev-only-change-me';
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptSecret(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptSecret(payload) {
  if (!payload) return '';
  const [ivB64, tagB64, encryptedB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !encryptedB64) return '';
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export function makeRateLimiter({ windowMs, max, keyPrefix }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = `${keyPrefix}:${clientIp(req)}:${req.user?.id || 'anon'}`;
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= max) {
      return res.status(429).json({ error: 'Too many requests' });
    }
    entry.count += 1;
    return next();
  };
}

export function sanitizeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/api[_ -]?key|authorization|bearer|secret|token/i.test(message)) {
    return 'Upstream AI request failed';
  }
  return message.slice(0, 160);
}
