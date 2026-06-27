import { db, getUserByPhone, nowIso } from './db.js';

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  SUB_ADMIN: 'sub_admin',
  USER: 'user',
};

const ROLE_RANK = {
  [ROLES.USER]: 0,
  [ROLES.SUB_ADMIN]: 1,
  [ROLES.ADMIN]: 2,
  [ROLES.SUPER_ADMIN]: 3,
};

const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: [
    'admin.roles.manage',
    'admin.users.view',
    'mail.send',
    'reward.grant',
    'truth.assets.upload',
    'truth.assets.edit',
    'truth.assets.submit',
    'truth.assets.publish',
    'truth.assets.archive',
  ],
  [ROLES.ADMIN]: [
    'admin.users.view',
    'mail.send',
    'reward.grant',
    'truth.assets.upload',
    'truth.assets.edit',
    'truth.assets.submit',
    'truth.assets.publish',
    'truth.assets.archive',
  ],
  [ROLES.SUB_ADMIN]: [
    'truth.assets.upload',
    'truth.assets.edit',
    'truth.assets.submit',
  ],
  [ROLES.USER]: [],
};

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function superAdminEmails() {
  const configured = String(process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map(cleanEmail)
    .filter(Boolean);
  return new Set(configured.length > 0 ? configured : ['3546064605@qq.com']);
}

export function getStoredUserRole(userId) {
  return db.prepare('SELECT role FROM user_roles WHERE user_id = ?').get(userId)?.role || ROLES.USER;
}

export function getUserRole(user) {
  if (!user) return ROLES.USER;
  if (superAdminEmails().has(cleanEmail(user.phone))) return ROLES.SUPER_ADMIN;
  if (!user.id) return ROLES.USER;
  const storedRole = getStoredUserRole(user.id);
  return Object.hasOwn(ROLE_RANK, storedRole) ? storedRole : ROLES.USER;
}

export function getUserPermissions(user) {
  const role = getUserRole(user);
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(user, permission) {
  return getUserPermissions(user).includes(permission);
}

export function isSuperAdmin(user) {
  return getUserRole(user) === ROLES.SUPER_ADMIN;
}

export function isAdmin(user) {
  return ROLE_RANK[getUserRole(user)] >= ROLE_RANK[ROLES.ADMIN];
}

export function isSubAdmin(user) {
  return ROLE_RANK[getUserRole(user)] >= ROLE_RANK[ROLES.SUB_ADMIN];
}

export function getAdminStatus(user) {
  const role = getUserRole(user);
  return {
    role,
    permissions: getUserPermissions(user),
    isSuperAdmin: role === ROLES.SUPER_ADMIN,
    isAdmin: ROLE_RANK[role] >= ROLE_RANK[ROLES.ADMIN],
    isSubAdmin: ROLE_RANK[role] >= ROLE_RANK[ROLES.SUB_ADMIN],
  };
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    return next();
  };
}

export function searchAdminUsers(query = '', limit = 30) {
  const text = `%${String(query || '').trim().toLowerCase()}%`;
  const rows = db.prepare(`
    SELECT u.id, u.phone, u.nickname, u.avatar, u.created_at, u.updated_at, r.role
    FROM users u
    LEFT JOIN user_roles r ON r.user_id = u.id
    WHERE lower(u.phone) LIKE ? OR lower(u.nickname) LIKE ?
    ORDER BY u.created_at DESC
    LIMIT ?
  `).all(text, text, Math.min(Math.max(Number(limit) || 30, 1), 100));

  return rows.map(row => ({
    id: row.id,
    phone: row.phone,
    nickname: row.nickname,
    avatar: row.avatar,
    role: superAdminEmails().has(cleanEmail(row.phone)) ? ROLES.SUPER_ADMIN : row.role || ROLES.USER,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function grantRole(actor, targetUserId, role) {
  if (!isSuperAdmin(actor)) throw httpError(403, 'Only super administrators can manage roles');
  if (![ROLES.ADMIN, ROLES.SUB_ADMIN, ROLES.USER].includes(role)) {
    throw httpError(400, 'Invalid role');
  }
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(String(targetUserId || ''));
  if (!target) throw httpError(404, 'User not found');
  if (superAdminEmails().has(cleanEmail(target.phone))) {
    throw httpError(400, 'Seed super administrator role cannot be changed here');
  }

  if (role === ROLES.USER) {
    db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(target.id);
  } else {
    db.prepare(`
      INSERT INTO user_roles (user_id, role, granted_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        role = excluded.role,
        granted_by = excluded.granted_by,
        updated_at = excluded.updated_at
    `).run(target.id, role, actor.id, nowIso(), nowIso());
  }
  return searchAdminUsers(target.phone, 1)[0];
}

export function revokeRole(actor, targetUserId) {
  return grantRole(actor, targetUserId, ROLES.USER);
}

export function getUserByEmailForAdmin(email) {
  return getUserByPhone(cleanEmail(email));
}
