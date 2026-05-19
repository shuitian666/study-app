import type { AIConfig, CheckinState, DrawBalance, InventoryItem, LotteryResult, Question, UpPoolResult, User } from '@/types';

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '');
export const API_BASE = configuredApiBase || '/api';

export function getAIConfig(): AIConfig {
  return { provider: 'server' };
}

export function setAIConfig(): void {
  // AI credentials are server-managed now.
}

export async function fetchModels() {
  const res = await fetch(`${API_BASE}/models`, { credentials: 'include' });
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

export interface AuthPayload {
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
  aiConfigStatus: ServerAIConfigStatus;
}

export async function sendEmailCode(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/email/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Failed to send email code');
}

export async function registerWithPassword(email: string, password: string, code: string): Promise<AuthPayload> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, code }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Register failed');
  return res.json();
}

export async function loginWithPassword(email: string, password: string): Promise<AuthPayload> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Login failed');
  return res.json();
}

export async function fetchMe(): Promise<AuthPayload | null> {
  const res = await fetch(`${API_BASE}/me`, { credentials: 'include' });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error('Failed to load user');
  return res.json();
}

async function accountRequest(path: string, body?: unknown): Promise<AuthPayload> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) {
    const err = new Error('Session expired');
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Account request failed');
  return res.json();
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

export function accountRedeem(code: string): Promise<AuthPayload> {
  return accountRequest('/account/redeem', { code });
}

export function accountDrawLottery(pool: 'regular' | 'up', count: 1 | 10): Promise<AuthPayload> {
  return accountRequest('/account/lottery/draw', { pool, count });
}

export function accountUseInventoryItem(itemId: string): Promise<AuthPayload> {
  return accountRequest('/account/inventory/use', { itemId });
}

export type AccountProfilePatch = Partial<Omit<User, 'activeTitle' | 'customAvatarUrl' | 'currentBackground'>> & {
  activeTitle?: string | null;
  customAvatarUrl?: string | null;
  currentBackground?: string | null;
};

export async function accountUpdateProfile(patch: AccountProfilePatch): Promise<AuthPayload> {
  const res = await fetch(`${API_BASE}/account/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  if (res.status === 401) {
    const err = new Error('Session expired');
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Profile update failed');
  return res.json();
}

export async function checkBackendAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export function resetBackendCache(): void {
  // Kept for existing callers.
}

export async function fetchAIConfig(): Promise<ServerAIConfigStatus> {
  const res = await fetch(`${API_BASE}/ai/config`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load AI config');
  return res.json();
}

export async function saveAIConfig(config: {
  mode: 'platform' | 'custom';
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}): Promise<ServerAIConfigStatus> {
  const res = await fetch(`${API_BASE}/ai/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Failed to save AI config');
  return res.json();
}

export async function* streamChat(params: {
  messages: { role: string; content: string }[];
  knowledgeContext?: string[];
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const { signal, ...body } = params;
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    signal,
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const error = (await res.json().catch(() => null))?.error;
    throw new Error(error || `Chat request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        let payload: { done?: boolean; error?: string; content?: string };
        try {
          payload = JSON.parse(trimmed.slice(6));
        } catch {
          continue;
        }
        if (payload.done) return;
        if (payload.error) throw new Error(payload.error);
        if (payload.content) yield payload.content;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function fetchQuiz(params: {
  knowledgePointNames: string[];
  knowledgePoints?: Array<{ id: string; name: string; masteryLevel: number; wrongCount: number; lastReviewedAt: string }>;
  subjectName: string;
  mode?: 'random' | 'smart';
}): Promise<{ question: Question | null; selectedKnowledgePoint?: string; mode: 'random' | 'smart' }> {
  const res = await fetch(`${API_BASE}/quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(params),
  });
  const data = await res.json();
  return { question: data.question || null, selectedKnowledgePoint: data.selectedKnowledgePoint, mode: data.mode || 'smart' };
}
