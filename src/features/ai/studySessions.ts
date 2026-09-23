import type { AIStudySession } from '@/types';
import { getAIStudySessions as localSessions } from '@/services/indexedDBService';
import { aiRequest } from './api';

const versions = new Map<string, number>();
export async function getAIStudySessions(ownerUserId: string): Promise<AIStudySession[]> {
  const migrationKey = `ai:v2:migrated:${ownerUserId}`;
  if (!localStorage.getItem(migrationKey)) {
    const sessions = await localSessions(ownerUserId);
    for (let i = 0; i < sessions.length; i += 100) await aiRequest('/ai/study-sessions/import', { method: 'POST', body: JSON.stringify({ sessions: sessions.slice(i, i + 100) }) });
    localStorage.setItem(migrationKey, '1');
  }
  const data = await aiRequest<{ sessions: AIStudySession[] }>('/ai/study-sessions');
  for (const session of data.sessions) versions.set(`${ownerUserId}:${session.id}`, session.version || 1);
  return data.sessions;
}
export async function saveAIStudySession(session: AIStudySession): Promise<void> {
  const { session: saved } = await aiRequest<{ session: AIStudySession }>(`/ai/study-sessions/${session.id}`, { method: 'PUT', body: JSON.stringify(session) });
  Object.assign(session, saved);
  versions.set(`${session.ownerUserId}:${session.id}`, saved.version || 1);
  window.dispatchEvent(new Event('ai:updated'));
}
export async function deleteAIStudySession(ownerUserId: string, sessionId: string): Promise<void> {
  const version = versions.get(`${ownerUserId}:${sessionId}`);
  await aiRequest(`/ai/study-sessions/${sessionId}?version=${version || 0}`, { method: 'DELETE' });
  versions.delete(`${ownerUserId}:${sessionId}`);
  window.dispatchEvent(new Event('ai:updated'));
}
