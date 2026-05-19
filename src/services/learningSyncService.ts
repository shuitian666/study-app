import { API_BASE } from './aiClient';
import type {
  LearningBootstrapPayload,
  LearningDeletePayload,
  LearningImportBatchPayload,
  LearningProgressPatch,
} from '@/types/learningSync';

async function learningRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    const err = new Error('Session expired');
    (err as Error & { status?: number }).status = 401;
    throw err;
  }

  if (!res.ok) {
    throw new Error((await res.json().catch(() => null))?.error || 'Learning sync request failed');
  }

  return res.json();
}

export function fetchLearningBootstrap(): Promise<LearningBootstrapPayload> {
  return learningRequest<LearningBootstrapPayload>('/learning/bootstrap');
}

export function importLearningBatch(payload: LearningImportBatchPayload): Promise<LearningBootstrapPayload> {
  return learningRequest<LearningBootstrapPayload>('/learning/import-batch', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function patchLearningProgress(payload: LearningProgressPatch): Promise<LearningBootstrapPayload> {
  return learningRequest<LearningBootstrapPayload>('/learning/progress', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteLearningRecords(payload: LearningDeletePayload): Promise<LearningBootstrapPayload> {
  return learningRequest<LearningBootstrapPayload>('/learning/delete', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
