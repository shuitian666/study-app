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
import { API_BASE, apiFetch } from '@/services/aiClient';
import { readAIStream } from '@/features/ai/stream';

async function aiStudyRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(`${API_BASE}${path}`, {
    ...options,
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
  const res = await apiFetch(`${API_BASE}/ai/study-tutor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error((await res.json().catch(() => null))?.error || '学习导师暂时不可用');
  }

  yield* readAIStream(res);
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
