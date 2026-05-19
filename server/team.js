import crypto from 'node:crypto';
import { db, getUserById, nowIso } from './db.js';

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

function initialProgress() {
  return {
    taskCompletionRate: 0,
    studyMinutes: 0,
    isReady: false,
    lastUpdated: nowIso(),
  };
}

function normalizeProgress(progress) {
  return {
    taskCompletionRate: Math.max(0, Math.min(1, Number(progress?.taskCompletionRate) || 0)),
    studyMinutes: Math.max(0, Math.round(Number(progress?.studyMinutes) || 0)),
    isReady: Boolean(progress?.isReady),
    lastUpdated: String(progress?.lastUpdated || nowIso()),
  };
}

function toMemberPayload(row) {
  return {
    id: row.user_id,
    name: row.name,
    avatar: row.avatar,
    avatarFrame: row.avatar_frame || undefined,
    isSimulated: Boolean(row.is_simulated),
    progress: {
      ...initialProgress(),
      ...parseJson(row.progress_payload, {}),
    },
  };
}

function readTeamByClause(whereClause, value) {
  const team = db.prepare(`
    SELECT *
    FROM teams
    WHERE ${whereClause}
    LIMIT 1
  `).get(value);

  if (!team || team.status === 'dissolved') {
    return null;
  }

  const members = db.prepare(`
    SELECT *
    FROM team_members
    WHERE team_id = ?
    ORDER BY joined_at ASC
  `).all(team.id).map(toMemberPayload);

  return {
    id: team.id,
    inviteCode: team.invite_code,
    members,
    status: team.status,
    createdAt: team.created_at,
    todayCheckedIn: Boolean(team.today_checked_in),
  };
}

function ensureMember(teamId, user) {
  const existing = db.prepare(`
    SELECT *
    FROM team_members
    WHERE team_id = ? AND user_id = ?
  `).get(teamId, user.id);

  if (existing) {
    db.prepare(`
      UPDATE team_members
      SET name = ?, avatar = ?, avatar_frame = ?, updated_at = ?
      WHERE team_id = ? AND user_id = ?
    `).run(user.nickname, user.avatar, user.avatar_frame || null, nowIso(), teamId, user.id);
    return;
  }

  db.prepare(`
    INSERT INTO team_members (id, team_id, user_id, name, avatar, avatar_frame, is_simulated, progress_payload, joined_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(
    `tm_${crypto.randomUUID()}`,
    teamId,
    user.id,
    user.nickname || 'Learning partner',
    user.avatar || 'user',
    user.avatar_frame || null,
    JSON.stringify(initialProgress()),
    nowIso(),
    nowIso(),
  );
}

function logTeamEvent(teamId, userId, eventType, payload = {}) {
  db.prepare(`
    INSERT INTO team_events (id, team_id, user_id, event_type, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(`tev_${crypto.randomUUID()}`, teamId, userId || null, eventType, JSON.stringify(payload), nowIso());
}

export function createTeamForUser(user) {
  const teamId = `team_${crypto.randomUUID()}`;
  const inviteCode = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  const createdAt = nowIso();

  db.prepare(`
    INSERT INTO teams (id, invite_code, owner_user_id, status, today_checked_in, created_at, updated_at)
    VALUES (?, ?, ?, 'waiting', 0, ?, ?)
  `).run(teamId, inviteCode, user.id, createdAt, createdAt);

  ensureMember(teamId, user);
  logTeamEvent(teamId, user.id, 'create', { inviteCode });
  return getTeam(teamId);
}

export function getTeam(idOrCode) {
  const value = String(idOrCode || '').trim();
  if (!value) return null;
  return value.toUpperCase() === value
    ? readTeamByClause('invite_code = ?', value)
    : readTeamByClause('id = ?', value);
}

export function joinTeamForUser(inviteCode, user) {
  const normalizedCode = String(inviteCode || '').trim().toUpperCase();
  const team = readTeamByClause('invite_code = ?', normalizedCode);
  if (!team) {
    const error = new Error('Team not found');
    error.status = 404;
    throw error;
  }
  if (team.members.length >= 2 && !team.members.some(member => member.id === user.id)) {
    const error = new Error('Team is full');
    error.status = 409;
    throw error;
  }

  ensureMember(team.id, user);
  const memberCount = db.prepare('SELECT COUNT(*) AS count FROM team_members WHERE team_id = ?').get(team.id).count;
  db.prepare(`
    UPDATE teams
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(memberCount >= 2 ? 'active' : 'waiting', nowIso(), team.id);
  logTeamEvent(team.id, user.id, 'join', {});
  return getTeam(team.id);
}

export function updateTeamProgressForUser(teamId, userOrId, progress) {
  const user = typeof userOrId === 'string' ? getUserById(userOrId) : userOrId;
  const team = getTeam(teamId);
  if (!team) {
    const error = new Error('Team not found');
    error.status = 404;
    throw error;
  }
  if (!user) {
    const error = new Error('Team member not found');
    error.status = 404;
    throw error;
  }

  const member = db.prepare(`
    SELECT *
    FROM team_members
    WHERE team_id = ? AND user_id = ?
  `).get(team.id, user.id);
  if (!member) {
    const error = new Error('Team member not found');
    error.status = 404;
    throw error;
  }

  const nextProgress = normalizeProgress(progress);
  db.prepare(`
    UPDATE team_members
    SET name = ?, avatar = ?, avatar_frame = ?, progress_payload = ?, updated_at = ?
    WHERE team_id = ? AND user_id = ?
  `).run(
    user.nickname,
    user.avatar,
    user.avatar_frame || null,
    JSON.stringify(nextProgress),
    nowIso(),
    team.id,
    user.id,
  );
  db.prepare('UPDATE teams SET updated_at = ? WHERE id = ?').run(nowIso(), team.id);
  logTeamEvent(team.id, user.id, 'progress', nextProgress);
  return getTeam(team.id);
}

export function dissolveTeamForUser(teamId, userId) {
  const team = getTeam(teamId);
  if (!team) {
    return { ok: true };
  }
  const member = db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?').get(team.id, userId);
  if (!member) {
    const error = new Error('Team member not found');
    error.status = 403;
    throw error;
  }

  db.prepare(`
    UPDATE teams
    SET status = 'dissolved', updated_at = ?
    WHERE id = ?
  `).run(nowIso(), team.id);
  logTeamEvent(team.id, userId, 'dissolve', {});
  return { ok: true };
}
