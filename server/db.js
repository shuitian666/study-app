import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'app.sqlite'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  nickname TEXT NOT NULL,
  avatar TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sms_codes (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_assets (
  user_id TEXT PRIMARY KEY,
  coins INTEGER NOT NULL DEFAULT 0,
  experience INTEGER NOT NULL DEFAULT 0,
  checkin_streak INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checkin_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date_key TEXT NOT NULL,
  reward_payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE(user_id, date_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS asset_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  coins_delta INTEGER NOT NULL DEFAULT 0,
  experience_delta INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE(user_id, event_type, source_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_ai_configs (
  user_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'platform',
  base_url TEXT,
  model TEXT,
  encrypted_api_key TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_usage_daily (
  user_id TEXT NOT NULL,
  date_key TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, date_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_quota (
  user_id TEXT PRIMARY KEY,
  daily_request_limit INTEGER,
  monthly_request_limit INTEGER,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_game_state (
  user_id TEXT PRIMARY KEY,
  redeemed_codes TEXT NOT NULL DEFAULT '[]',
  shop_owned_ids TEXT NOT NULL DEFAULT '[]',
  up_pool_owned_ids TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

function addColumn(table, columnDef) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
  } catch {
    // Existing databases may already have the column.
  }
}

try {
  db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
} catch {
  // Existing databases may already have the column.
}

addColumn('user_assets', 'regular_tickets INTEGER NOT NULL DEFAULT 0');
addColumn('user_assets', 'up_tickets INTEGER NOT NULL DEFAULT 0');
addColumn('user_assets', 'makeup_cards INTEGER NOT NULL DEFAULT 0');
addColumn('user_assets', 'lottery_pity_sr INTEGER NOT NULL DEFAULT 0');
addColumn('user_assets', 'lottery_pity_ssr INTEGER NOT NULL DEFAULT 0');

export function nowIso() {
  return new Date().toISOString();
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function getUserByPhone(phone) {
  return db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
}

export function createUser(phone, passwordHash = null) {
  const createdAt = nowIso();
  const user = {
    id: `usr_${crypto.randomUUID()}`,
    phone,
    nickname: `User ${phone.slice(-4)}`,
    avatar: 'user',
    created_at: createdAt,
    updated_at: createdAt,
  };

  db.prepare(`
    INSERT INTO users (id, phone, password_hash, nickname, avatar, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(user.id, user.phone, passwordHash, user.nickname, user.avatar, user.created_at, user.updated_at);

  db.prepare(`
    INSERT INTO user_assets (user_id, coins, experience, checkin_streak, regular_tickets, up_tickets, makeup_cards, lottery_pity_sr, lottery_pity_ssr, updated_at)
    VALUES (?, 0, 0, 0, 0, 0, 0, 0, 0, ?)
  `).run(user.id, createdAt);

  db.prepare(`
    INSERT INTO user_game_state (user_id, redeemed_codes, shop_owned_ids, up_pool_owned_ids, updated_at)
    VALUES (?, '[]', '[]', '[]', ?)
  `).run(user.id, createdAt);

  db.prepare(`
    INSERT INTO user_ai_configs (user_id, mode, updated_at)
    VALUES (?, 'platform', ?)
  `).run(user.id, createdAt);

  db.prepare(`
    INSERT INTO ai_quota (user_id, daily_request_limit, monthly_request_limit, updated_at)
    VALUES (?, NULL, NULL, ?)
  `).run(user.id, createdAt);

  return user;
}

export function toPublicUser(row, assets) {
  return {
    id: row.id,
    phone: row.phone,
    nickname: row.nickname,
    avatar: row.avatar,
    learningDays: 0,
    totalStudyMinutes: 0,
    totalPoints: assets?.coins ?? 0,
    bonusExperience: assets?.experience ?? 0,
    experienceLedger: [],
    createdAt: row.created_at,
    dailyGoal: 10,
    dailyNewGoal: 10,
    todayQuestions: 0,
    goalAchievedToday: false,
    avatarFrame: null,
    aiSkin: null,
    background: null,
    unlockedAvatars: ['user'],
    unlockedFrames: [],
    unlockedAiSkins: [],
    unlockedBackgrounds: [],
    themeStyle: 'default',
  };
}

export function getAssets(userId) {
  return db.prepare('SELECT * FROM user_assets WHERE user_id = ?').get(userId);
}

export function getInventory(userId) {
  return db.prepare('SELECT * FROM inventory_items WHERE user_id = ? ORDER BY created_at DESC').all(userId);
}

export function getGameState(userId) {
  let row = db.prepare('SELECT * FROM user_game_state WHERE user_id = ?').get(userId);
  if (!row) {
    db.prepare(`
      INSERT INTO user_game_state (user_id, redeemed_codes, shop_owned_ids, up_pool_owned_ids, updated_at)
      VALUES (?, '[]', '[]', '[]', ?)
    `).run(userId, nowIso());
    row = db.prepare('SELECT * FROM user_game_state WHERE user_id = ?').get(userId);
  }
  return row;
}
