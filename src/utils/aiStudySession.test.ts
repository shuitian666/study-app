import type { AIStudyPlan } from '@/types';
import {
  checkpointCompletedChapterReview,
  checkpointCompletedKnowledgePoint,
  createAIStudySession,
} from './aiStudySession';

const plan: AIStudyPlan = {
  id: 'plan-1',
  subjectId: 'subject-1',
  subjectName: 'Test subject',
  subjectSource: 'generated',
  subjectIcon: 'T',
  subjectColor: '#000000',
  goal: 'Learn',
  chapters: [
    {
      id: 'chapter-1',
      name: 'Chapter 1',
      source: 'generated',
      order: 1,
      goal: 'First',
      knowledgePoints: [
        { id: 'kp-1', name: 'One', source: 'generated', goal: 'One', difficulty: 'basic', baseExplanation: 'One' },
        { id: 'kp-2', name: 'Two', source: 'generated', goal: 'Two', difficulty: 'standard', baseExplanation: 'Two' },
      ],
    },
    {
      id: 'chapter-2',
      name: 'Chapter 2',
      source: 'generated',
      order: 2,
      goal: 'Second',
      knowledgePoints: [
        { id: 'kp-3', name: 'Three', source: 'generated', goal: 'Three', difficulty: 'standard', baseExplanation: 'Three' },
      ],
    },
  ],
  createdAt: '2026-06-12T00:00:00.000Z',
};

describe('AI study session checkpoints', () => {
  test('advances to the next knowledge point after a completed point', () => {
    const session = createAIStudySession('user-1', plan, '2026-06-12T00:00:00.000Z');
    const next = checkpointCompletedKnowledgePoint(session, {
      chapterIndex: 0,
      knowledgePointIndex: 0,
      resolvedKnowledgePointId: 'saved-kp-1',
      resolvedChapterId: 'saved-chapter-1',
      correctCount: 2,
      totalQuestions: 3,
      weakKnowledgePointIds: ['kp-1'],
      now: '2026-06-12T00:05:00.000Z',
    });

    expect(next).toMatchObject({
      mode: 'explaining',
      currentChapterIndex: 0,
      currentKnowledgePointIndex: 1,
      correctCount: 2,
      totalQuestions: 3,
      completedKnowledgePointIds: ['kp-1'],
      resolvedKnowledgePointIds: { 'kp-1': 'saved-kp-1' },
    });
  });

  test('moves to chapter review after the final point in a chapter', () => {
    const session = createAIStudySession('user-1', plan);
    const next = checkpointCompletedKnowledgePoint(session, {
      chapterIndex: 0,
      knowledgePointIndex: 1,
      resolvedKnowledgePointId: 'saved-kp-2',
      resolvedChapterId: 'saved-chapter-1',
      correctCount: 5,
      totalQuestions: 6,
      weakKnowledgePointIds: [],
    });

    expect(next.mode).toBe('chapter_review');
    expect(next.currentKnowledgePointIndex).toBe(1);
  });

  test('advances after chapter review and returns null after the final chapter', () => {
    const session = {
      ...createAIStudySession('user-1', plan),
      mode: 'chapter_review' as const,
      currentChapterIndex: 0,
      currentKnowledgePointIndex: 1,
    };
    const next = checkpointCompletedChapterReview(session, 6, 7, []);

    expect(next).toMatchObject({
      mode: 'explaining',
      currentChapterIndex: 1,
      currentKnowledgePointIndex: 0,
      correctCount: 6,
      totalQuestions: 7,
    });
    expect(checkpointCompletedChapterReview({ ...session, currentChapterIndex: 1 }, 7, 8, [])).toBeNull();
  });
});
