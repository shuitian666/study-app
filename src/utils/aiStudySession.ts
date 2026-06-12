import type { AIStudyPlan, AIStudySession } from '@/types';

export function createAIStudySession(
  ownerUserId: string,
  plan: AIStudyPlan,
  now = new Date().toISOString(),
): AIStudySession {
  return {
    id: `ai-session-${plan.id}`,
    ownerUserId,
    plan,
    mode: 'explaining',
    currentChapterIndex: 0,
    currentKnowledgePointIndex: 0,
    correctCount: 0,
    totalQuestions: 0,
    weakKnowledgePointIds: [],
    completedKnowledgePointIds: [],
    resolvedKnowledgePointIds: {},
    resolvedChapterIds: {},
    startedAt: now,
    updatedAt: now,
  };
}

interface KnowledgePointCheckpointInput {
  chapterIndex: number;
  knowledgePointIndex: number;
  resolvedKnowledgePointId: string;
  resolvedChapterId: string;
  correctCount: number;
  totalQuestions: number;
  weakKnowledgePointIds: string[];
  now?: string;
}

export function checkpointCompletedKnowledgePoint(
  session: AIStudySession,
  input: KnowledgePointCheckpointInput,
): AIStudySession {
  const chapter = session.plan.chapters[input.chapterIndex];
  const point = chapter?.knowledgePoints[input.knowledgePointIndex];
  if (!chapter || !point) throw new Error('Cannot checkpoint a missing knowledge point');

  const hasNextPoint = input.knowledgePointIndex + 1 < chapter.knowledgePoints.length;
  return {
    ...session,
    mode: hasNextPoint ? 'explaining' : 'chapter_review',
    currentChapterIndex: input.chapterIndex,
    currentKnowledgePointIndex: hasNextPoint
      ? input.knowledgePointIndex + 1
      : input.knowledgePointIndex,
    correctCount: input.correctCount,
    totalQuestions: input.totalQuestions,
    weakKnowledgePointIds: [...input.weakKnowledgePointIds],
    completedKnowledgePointIds: Array.from(new Set([
      ...session.completedKnowledgePointIds,
      point.id,
    ])),
    resolvedKnowledgePointIds: {
      ...session.resolvedKnowledgePointIds,
      [point.id]: input.resolvedKnowledgePointId,
    },
    resolvedChapterIds: {
      ...session.resolvedChapterIds,
      [chapter.id]: input.resolvedChapterId,
    },
    updatedAt: input.now || new Date().toISOString(),
  };
}

export function checkpointCompletedChapterReview(
  session: AIStudySession,
  correctCount: number,
  totalQuestions: number,
  weakKnowledgePointIds: string[],
  now = new Date().toISOString(),
): AIStudySession | null {
  const nextChapterIndex = session.currentChapterIndex + 1;
  if (nextChapterIndex >= session.plan.chapters.length) return null;

  return {
    ...session,
    mode: 'explaining',
    currentChapterIndex: nextChapterIndex,
    currentKnowledgePointIndex: 0,
    correctCount,
    totalQuestions,
    weakKnowledgePointIds: [...weakKnowledgePointIds],
    updatedAt: now,
  };
}
