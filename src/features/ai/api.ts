import { API_BASE, apiFetch } from '@/services/aiClient';
import { AIRequestError, readAIStream } from './stream';
export { AIRequestError, readAIStream } from './stream';
import type { AIStudyTutorContext, AIStudySession, AIStudySummary } from '@/types';

export type ConversationKind = 'general' | 'contextual_help' | 'study_tutor';
export interface Conversation { id: string; title: string; kind: ConversationKind; updatedAt: string; context?: AIStudyTutorContext }
export interface Message { id: string; role: 'user' | 'assistant'; content: string; status: 'complete' | 'streaming' | 'failed' | 'interrupted' | 'cancelled'; createdAt: string; cursor?: number }
export interface QuotaWindow { limit: number; used: number; remaining: number; restoresAt: string | null }
export interface Quota { level: number; short: QuotaWindow; week: QuotaWindow; weights: Record<string, number> }
export interface Bootstrap {
  enabled: boolean; quota: Quota; conversations: Conversation[]; sessions: AIStudySession[]; summaries: AIStudySummary[];
  config: { mode: 'platform' | 'custom'; platformConfigured: boolean; customConfigured: boolean };
  truth: { enabled: boolean };
}
export async function aiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(`${API_BASE}${path}`, {
    ...options, headers: { 'Content-Type': 'application/json', 'X-Request-Id': crypto.randomUUID(), ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new AIRequestError(data.message || data.error || 'AI 请求失败，请重试', data.code, res.status, data.quota);
  return data;
}
export async function* streamConversation(id: string, body: unknown, signal: AbortSignal, requestId: string) {
  const res = await apiFetch(`${API_BASE}/ai/conversations/${encodeURIComponent(id)}/messages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId }, body: JSON.stringify(body), signal,
  });
  yield* readAIStream(res);
}
