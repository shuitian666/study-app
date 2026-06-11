import type {
  AIStudyExplanation,
  AIStudyPlan,
  AIStudySummary,
  AIStudyTutorContext,
  AIStudyTutorMessage,
  Chapter,
  KnowledgePointExtended,
  Question,
  Subject,
} from '@/types';
import { API_BASE } from '@/services/aiClient';

async function aiStudyRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    throw new Error((await res.json().catch(() => null))?.error || 'AI study request failed');
  }
  return res.json();
}

export interface StudyPlanInput {
  goal: string;
  scopeSubjectId?: string;
  subjects: Subject[];
  chapters: Chapter[];
  knowledgePoints: KnowledgePointExtended[];
}

export function fetchAIStudyPlan(input: StudyPlanInput): Promise<{ plan: AIStudyPlan }> {
  return aiStudyRequest('/ai/study-plan', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchAIStudyExplanation(input: {
  subjectId: string;
  knowledgePoint: KnowledgePointExtended | AIStudyPlan['chapters'][number]['knowledgePoints'][number];
  goal?: string;
  difficulty?: string;
}): Promise<AIStudyExplanation> {
  return aiStudyRequest('/ai/study-explain', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function* streamAIStudyTutor(input: {
  query: string;
  context: AIStudyTutorContext;
  history: AIStudyTutorMessage[];
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const { signal, ...body } = input;
  const res = await fetch(`${API_BASE}/ai/study-tutor`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error((await res.json().catch(() => null))?.error || '学习导师暂时不可用');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const payload = JSON.parse(trimmed.slice(6)) as { content?: string; error?: string; done?: boolean };
        if (payload.error) throw new Error(payload.error);
        if (payload.done) return;
        if (payload.content) yield payload.content;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function fetchAIStudyPractice(input: {
  subjectId: string;
  knowledgePoint: KnowledgePointExtended | AIStudyPlan['chapters'][number]['knowledgePoints'][number];
  difficulty?: string;
}): Promise<{ questions: Question[] }> {
  return aiStudyRequest('/ai/study-practice', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchAIChapterSynthesis(input: {
  subjectId: string;
  chapter: Chapter | AIStudyPlan['chapters'][number];
  knowledgePoints: Array<KnowledgePointExtended | AIStudyPlan['chapters'][number]['knowledgePoints'][number]>;
}): Promise<{ questions: Question[] }> {
  return aiStudyRequest('/ai/chapter-synthesis', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function saveAIStudySummary(input: Omit<AIStudySummary, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<{ summary: AIStudySummary }> {
  return aiStudyRequest('/ai/study-summary', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchAIStudySummaries(): Promise<{ summaries: AIStudySummary[] }> {
  return aiStudyRequest('/ai/study-summaries');
}
