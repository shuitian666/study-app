import type { AIConfig, Question } from '@/types';

export const API_BASE = '/api';

export function getAIConfig(): AIConfig {
  return { provider: 'server' };
}

export function setAIConfig(_config: unknown): void {
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
  user: any;
  assets: { coins: number; experience: number; checkinStreak: number };
  inventory: any[];
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
}): AsyncGenerator<string> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(params),
  });

  if (!res.ok || !res.body) throw new Error(`Chat request failed: ${res.status}`);

  const reader = res.body.getReader();
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
      const payload = JSON.parse(trimmed.slice(6));
      if (payload.done) return;
      if (payload.error) throw new Error(payload.error);
      if (payload.content) yield payload.content;
    }
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
