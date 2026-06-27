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

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  granted_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS system_mails (
  id TEXT PRIMARY KEY,
  sender_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  audience_type TEXT NOT NULL,
  audience_payload TEXT NOT NULL DEFAULT '{}',
  claim_deadline TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  system_mail INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS mail_recipients (
  id TEXT PRIMARY KEY,
  mail_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(mail_id, user_id),
  FOREIGN KEY (mail_id) REFERENCES system_mails(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mail_attachments (
  id TEXT PRIMARY KEY,
  mail_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  reward_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  rarity TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE(mail_id, position),
  FOREIGN KEY (mail_id) REFERENCES system_mails(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mail_claims (
  id TEXT PRIMARY KEY,
  mail_id TEXT NOT NULL,
  attachment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, attachment_id),
  FOREIGN KEY (mail_id) REFERENCES system_mails(id) ON DELETE CASCADE,
  FOREIGN KEY (attachment_id) REFERENCES mail_attachments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  invite_code TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  today_checked_in INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  is_simulated INTEGER NOT NULL DEFAULT 0,
  progress_payload TEXT NOT NULL DEFAULT '{}',
  joined_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(team_id, user_id),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_events (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  user_id TEXT,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_subjects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual',
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_chapters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject_id TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual',
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_knowledge_points (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject_id TEXT,
  chapter_id TEXT,
  import_id TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual',
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_questions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  knowledge_point_id TEXT,
  import_id TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual',
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_learning_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  knowledge_point_id TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE(user_id, knowledge_point_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_wrong_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_question_explanations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE(user_id, question_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_import_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'local-import',
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_study_summaries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject_id TEXT,
  chapter_ids TEXT NOT NULL DEFAULT '[]',
  knowledge_point_ids TEXT NOT NULL DEFAULT '[]',
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS truth_assets (
  id TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  thumbnail_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  batch_code TEXT NOT NULL,
  animal_id TEXT,
  species TEXT NOT NULL,
  strain TEXT,
  sex TEXT NOT NULL,
  drug_name TEXT,
  drug_aliases TEXT NOT NULL DEFAULT '[]',
  dose_value TEXT,
  dose_unit TEXT,
  administration_route TEXT,
  phase TEXT NOT NULL,
  time_value REAL,
  time_unit TEXT,
  body_part TEXT,
  observation TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_truth_assets_search
ON truth_assets (status, drug_name, phase, time_value, time_unit, sex);

CREATE INDEX IF NOT EXISTS idx_truth_assets_batch
ON truth_assets (status, batch_code, animal_id);

CREATE TABLE IF NOT EXISTS truth_drug_aliases (
  alias_key TEXT PRIMARY KEY,
  alias TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_truth_drug_canonical
ON truth_drug_aliases (canonical_name);

CREATE TABLE IF NOT EXISTS truth_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  query_text TEXT,
  filter_snapshot TEXT NOT NULL DEFAULT '{}',
  content TEXT NOT NULL,
  model_info TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS truth_report_assets (
  report_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  asset_snapshot TEXT NOT NULL,
  PRIMARY KEY (report_id, asset_id),
  FOREIGN KEY (report_id) REFERENCES truth_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id) REFERENCES truth_assets(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  reminder_time TEXT NOT NULL DEFAULT '20:00',
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  push_enabled INTEGER NOT NULL DEFAULT 0,
  email_fallback_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  subscription_json TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, endpoint),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notification_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE(user_id, date_key, kind, channel),
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
addColumn('users', 'custom_avatar_url TEXT');
addColumn('users', 'avatar_frame TEXT');
addColumn('users', 'ai_skin TEXT');
addColumn('users', 'background TEXT');
addColumn("users", "theme_style TEXT NOT NULL DEFAULT 'default'");
addColumn('users', 'active_title TEXT');
addColumn('users', "learning_profile TEXT NOT NULL DEFAULT '{}'");
addColumn('users', 'daily_goal INTEGER NOT NULL DEFAULT 10');
addColumn('team_members', 'avatar_frame TEXT');

export function nowIso() {
  return new Date().toISOString();
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function getUserByPhone(phone) {
  return db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
}

function parseJson(value, fallback = {}) {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

function normalizeLearningProfile(input = {}) {
  const validGoals = new Set(['daily_review', 'exam_cram', 'foundation', 'weakness_fix']);
  const goals = Array.isArray(input.goals)
    ? input.goals.map(String).filter(goal => validGoals.has(goal)).slice(0, 3)
    : [];

  return {
    goals: goals.length > 0 ? goals : ['daily_review'],
    studyDirection: ['medical', 'pharmacy', 'nursing', 'english', 'general'].includes(input.studyDirection)
      ? input.studyDirection
      : 'general',
    explanationStyle: ['concise', 'step_by_step', 'analogy', 'exam_oriented'].includes(input.explanationStyle)
      ? input.explanationStyle
      : 'step_by_step',
    preferredDifficulty: ['basic', 'standard', 'challenge'].includes(input.preferredDifficulty)
      ? input.preferredDifficulty
      : 'standard',
    practicePreference: ['explain_then_practice', 'quiz_then_explain', 'wrong_only'].includes(input.practicePreference)
      ? input.practicePreference
      : 'explain_then_practice',
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : nowIso(),
  };
}

export function updateUserProfile(userId, patch) {
  const allowed = [
    ['nickname', 'nickname'],
    ['avatar', 'avatar'],
    ['customAvatarUrl', 'custom_avatar_url'],
    ['avatarFrame', 'avatar_frame'],
    ['aiSkin', 'ai_skin'],
    ['background', 'background'],
    ['themeStyle', 'theme_style'],
    ['activeTitle', 'active_title'],
    ['learningProfile', 'learning_profile'],
    ['dailyGoal', 'daily_goal'],
  ];
  const assignments = [];
  const values = [];

  for (const [inputKey, columnName] of allowed) {
    if (!Object.prototype.hasOwnProperty.call(patch, inputKey)) continue;
    let value = patch[inputKey];
    if (inputKey === 'nickname') {
      value = String(value || '').trim().slice(0, 12);
      if (!value) continue;
    } else if (inputKey === 'themeStyle') {
      value = value === 'fluidScholar' ? 'fluidScholar' : 'default';
    } else if (inputKey === 'learningProfile') {
      value = JSON.stringify(normalizeLearningProfile(value && typeof value === 'object' ? value : {}));
    } else if (inputKey === 'dailyGoal') {
      value = Math.max(1, Math.min(200, Math.round(Number(value) || 10)));
    } else if (value === undefined || value === '') {
      value = null;
    } else if (value !== null) {
      value = String(value);
    }
    assignments.push(`${columnName} = ?`);
    values.push(value);
  }

  if (assignments.length === 0) {
    return getUserById(userId);
  }

  assignments.push('updated_at = ?');
  values.push(nowIso(), userId);
  db.prepare(`
    UPDATE users
    SET ${assignments.join(', ')}
    WHERE id = ?
  `).run(...values);
  return getUserById(userId);
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
    dailyGoal: Number.isFinite(row.daily_goal) && row.daily_goal > 0 ? row.daily_goal : 10,
    dailyNewGoal: Number.isFinite(row.daily_goal) && row.daily_goal > 0 ? row.daily_goal : 10,
    todayQuestions: 0,
    goalAchievedToday: false,
    avatarFrame: row.avatar_frame ?? null,
    aiSkin: row.ai_skin ?? null,
    background: row.background ?? null,
    unlockedAvatars: ['user'],
    unlockedFrames: [],
    unlockedAiSkins: [],
    unlockedBackgrounds: [],
    customAvatarUrl: row.custom_avatar_url ?? undefined,
    themeStyle: row.theme_style || 'default',
    activeTitle: row.active_title ?? undefined,
    learningProfile: normalizeLearningProfile(parseJson(row.learning_profile, {})),
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
