import type {
  AIStudyPlan,
  AIStudySummary,
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
  subject: Subject;
  chapters: Chapter[];
  knowledgePoints: KnowledgePointExtended[];
  goal?: string;
  chapterIds?: string[];
  knowledgePointIds?: string[];
}

export function fetchAIStudyPlan(input: StudyPlanInput): Promise<{ plan: AIStudyPlan }> {
  return aiStudyRequest('/ai/study-plan', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchAIStudyExplanation(input: {
  subjectId: string;
  knowledgePoint: KnowledgePointExtended;
  goal?: string;
}): Promise<{ title: string; explanation: string; memoryTip: string }> {
  return aiStudyRequest('/ai/study-explain', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchAIStudyPractice(input: {
  subjectId: string;
  knowledgePoint: KnowledgePointExtended;
  difficulty?: string;
}): Promise<{ questions: Question[] }> {
  return aiStudyRequest('/ai/study-practice', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchAIChapterSynthesis(input: {
  subjectId: string;
  chapter: Chapter;
  knowledgePoints: KnowledgePointExtended[];
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
