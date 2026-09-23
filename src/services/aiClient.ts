import type {
  AIConfig,
  AILearningContext,
  CheckinState,
  DrawBalance,
  InventoryItem,
  LotteryResult,
  MailAttachment,
  MailItem,
  MailState,
  Question,
  UpPoolResult,
  User,
} from '@/types';
import { Capacitor } from '@capacitor/core';
import { readAIStream } from '@/features/ai/stream';

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '');
const NATIVE_API_BASE = 'https://zhixueassistant.cn/api';
const SESSION_TOKEN_KEY = 'study-app:session-token:v1';

export const API_BASE = configuredApiBase || (Capacitor.isNativePlatform() ? NATIVE_API_BASE : '/api');

export function getSessionToken(): string {
  return localStorage.getItem(SESSION_TOKEN_KEY) || '';
}

export function setSessionToken(token: string | null | undefined): void {
  if (token) localStorage.setItem(SESSION_TOKEN_KEY, token);
  else if (token === null) localStorage.removeItem(SESSION_TOKEN_KEY);
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const sessionToken = getSessionToken();
  if (sessionToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? 'include',
  });
}

export function getAIConfig(): AIConfig {
  return { provider: 'server' };
}

export function setAIConfig(): void {
  // AI credentials are server-managed now.
}

export async function fetchModels() {
  const res = await apiFetch(`${API_BASE}/models`);
  const data = await res.json();
  return data.providers || [];
}

export interface ServerAIConfigStatus {
  mode: 'platform' | 'custom';
  customConfigured: boolean;
  baseUrl: string;
  model: string;
  platformConfigured: boolean;
}

export interface AdminStatus {
  role: User['role'];
  permissions: NonNullable<User['permissions']>;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isSubAdmin: boolean;
}

export interface AuthPayload {
  sessionToken?: string;
  user: User;
  assets: {
    coins: number;
    experience: number;
    checkinStreak: number;
    regularTickets: number;
    upTickets: number;
    makeupCards: number;
    lotteryPity: { sinceLastSR: number; sinceLastSSR: number };
  };
  checkin: CheckinState;
  drawBalance: DrawBalance;
  inventory: InventoryItem[];
  mail: MailState;
  admin: AdminStatus;
  game: {
    redeemedCodes: string[];
    shopOwnedIds: string[];
    upPoolOwnedIds: string[];
  };
  lastCheckinReward?: {
    regularTickets: number;
    upTickets: number;
    streakCoins: number;
    streakLabel?: string;
    source?: 'checkin' | 'makeup' | 'team_upgrade';
  };
  lottery?: {
    pool: 'regular' | 'up';
    result: LotteryResult | UpPoolResult;
    allResults: Array<LotteryResult | UpPoolResult>;
    isTenDraw: boolean;
  };
  experienceReward?: {
    amount: number;
    reason: 'knowledge_point_acceleration';
  };
  levelReward?: {
    level: number;
    claimed: boolean;
    item?: InventoryItem;
  };
  aiConfigStatus: ServerAIConfigStatus;
}

function rememberSessionToken(payload: AuthPayload): AuthPayload {
  if (payload.sessionToken) setSessionToken(payload.sessionToken);
  return payload;
}

export async function sendEmailCode(email: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/auth/email/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Failed to send email code');
}

export async function registerWithPassword(email: string, password: string, code: string): Promise<AuthPayload> {
  const res = await apiFetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, code }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Register failed');
  return rememberSessionToken(await res.json());
}

export async function loginWithPassword(email: string, password: string): Promise<AuthPayload> {
  const res = await apiFetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Login failed');
  return rememberSessionToken(await res.json());
}

export async function fetchMe(): Promise<AuthPayload | null> {
  const res = await apiFetch(`${API_BASE}/me`);
  if (res.status === 401) {
    setSessionToken(null);
    return null;
  }
  if (!res.ok) throw new Error('Failed to load user');
  return rememberSessionToken(await res.json());
}

export async function accountLogout(): Promise<void> {
  const res = await apiFetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
  });
  setSessionToken(null);
  if (res.status === 401) return;
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Logout failed');
}

async function accountRequest(path: string, body?: unknown): Promise<AuthPayload> {
  const res = await apiFetch(`${API_BASE}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) {
    const err = new Error('Session expired');
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Account request failed');
  return rememberSessionToken(await res.json());
}

export function fetchAccountState(): Promise<AuthPayload> {
  return accountRequest('/account/state');
}

export function accountCheckin(date: string): Promise<AuthPayload> {
  return accountRequest('/account/checkin', { date });
}

export function accountMakeupCheckin(date: string): Promise<AuthPayload> {
  return accountRequest('/account/makeup-checkin', { date });
}

export function accountBuyShopItem(itemId: string): Promise<AuthPayload> {
  return accountRequest('/account/shop/buy', { itemId });
}

export function accountGrantKnowledgePointExperience(
  knowledgePointId: string,
  learningExperience: number,
): Promise<AuthPayload> {
  return accountRequest('/account/experience/knowledge-point', {
    knowledgePointId,
    learningExperience,
  });
}

export function accountClaimLevelReward(level: number, learningExperience: number): Promise<AuthPayload> {
  return accountRequest('/account/level-rewards/claim', {
    level,
    learningExperience,
  });
}

export function accountRedeem(code: string): Promise<AuthPayload> {
  return accountRequest('/account/redeem', { code });
}

export function accountDrawLottery(pool: 'regular' | 'up', count: 1 | 10): Promise<AuthPayload> {
  return accountRequest('/account/lottery/draw', { pool, count });
}

export function accountUseInventoryItem(itemId: string): Promise<AuthPayload> {
  return accountRequest('/account/inventory/use', { itemId });
}

export function accountMarkMailRead(mailId: string): Promise<{ mail: MailState }> {
  return accountRequest(`/account/mail/${encodeURIComponent(mailId)}/read`, {}) as unknown as Promise<{ mail: MailState }>;
}

export function accountClaimMailAttachment(mailId: string, attachmentIdOrIndex: string | number): Promise<AuthPayload> {
  return accountRequest(`/account/mail/${encodeURIComponent(mailId)}/attachments/${encodeURIComponent(String(attachmentIdOrIndex))}/claim`, {});
}

export async function fetchAdminStatus(): Promise<AdminStatus> {
  const res = await apiFetch(`${API_BASE}/admin/status`);
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Failed to load admin status');
  return res.json();
}

export async function adminSendMail(input: {
  title: string;
  content: string;
  audience?: { type: 'all' } | { type: 'users'; userIds: string[] };
  claimDeadline?: string;
  attachments?: MailAttachment[];
}): Promise<{ mail: MailItem; recipientCount: number }> {
  const res = await apiFetch(`${API_BASE}/admin/mail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Failed to send mail');
  return res.json();
}

export interface AdminUserSummary {
  id: string;
  phone: string;
  nickname: string;
  avatar: string;
  role: User['role'];
  createdAt: string;
  updatedAt: string;
}

export async function adminSearchUsers(query: string): Promise<{ users: AdminUserSummary[] }> {
  const res = await apiFetch(`${API_BASE}/admin/users?query=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Failed to search users');
  return res.json();
}

export async function adminGrantRole(userId: string, role: Exclude<User['role'], undefined>): Promise<{ user: AdminUserSummary }> {
  const res = await apiFetch(`${API_BASE}/admin/roles/grant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, role }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Failed to grant role');
  return res.json();
}

export async function adminRevokeRole(userId: string): Promise<{ user: AdminUserSummary }> {
  const res = await apiFetch(`${API_BASE}/admin/roles/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Failed to revoke role');
  return res.json();
}

export type AccountProfilePatch = Partial<Omit<User, 'activeTitle' | 'customAvatarUrl' | 'currentBackground'>> & {
  activeTitle?: string | null;
  customAvatarUrl?: string | null;
  currentBackground?: string | null;
};

export async function accountUpdateProfile(patch: AccountProfilePatch): Promise<AuthPayload> {
  const res = await apiFetch(`${API_BASE}/account/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (res.status === 401) {
    const err = new Error('Session expired');
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Profile update failed');
  return rememberSessionToken(await res.json());
}

export async function checkBackendAvailable(): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export function resetBackendCache(): void {
  // Kept for existing callers.
}

export async function fetchAIConfig(): Promise<ServerAIConfigStatus> {
  const res = await apiFetch(`${API_BASE}/ai/config`);
  if (!res.ok) throw new Error('Failed to load AI config');
  return res.json();
}

export async function saveAIConfig(config: {
  mode: 'platform' | 'custom';
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}): Promise<ServerAIConfigStatus> {
  const res = await apiFetch(`${API_BASE}/ai/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Failed to save AI config');
  return res.json();
}

export async function* streamChat(params: {
  messages: { role: string; content: string }[];
  knowledgeContext?: string[];
  learningContext?: AILearningContext;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const { signal, ...body } = params;
  const res = await apiFetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const error = (await res.json().catch(() => null))?.error;
    throw new Error(error || `Chat request failed: ${res.status}`);
  }

  yield* readAIStream(res);
}

export async function fetchQuiz(params: {
  knowledgePointNames: string[];
  knowledgePoints?: Array<{ id: string; name: string; masteryLevel: number; wrongCount: number; lastReviewedAt: string }>;
  subjectName: string;
  mode?: 'random' | 'smart';
  learningContext?: AILearningContext;
}): Promise<{ question: Question | null; selectedKnowledgePoint?: string; mode: 'random' | 'smart' }> {
  const res = await apiFetch(`${API_BASE}/quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'AI 练习生成失败');
  return { question: data.question || null, selectedKnowledgePoint: data.selectedKnowledgePoint, mode: data.mode || 'smart' };
}
