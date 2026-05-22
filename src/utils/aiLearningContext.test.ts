import { buildAILearningContext, rankKnowledgePointsForAI } from './aiLearningContext';
import type { KnowledgePointExtended, Question, WrongRecord } from '@/types';

function kp(patch: Partial<KnowledgePointExtended> & { id: string; name: string }): KnowledgePointExtended {
  return {
    subjectId: 'subject-1',
    chapterId: 'chapter-1',
    explanation: '',
    proficiency: 'normal',
    lastReviewedAt: null,
    nextReviewAt: null,
    reviewCount: 0,
    createdAt: '2026-05-01T00:00:00.000Z',
    source: 'manual',
    studyRecords: [],
    quizRecords: [],
    currentScore: 50,
    ...patch,
  };
}

const questions: Question[] = [
  {
    id: 'q-dose',
    knowledgePointId: 'kp-dose',
    subjectId: 'subject-1',
    type: 'single_choice',
    stem: 'Dose conversion question',
    options: [],
    correctAnswers: ['a'],
    explanation: '',
  },
];

const wrongRecords: WrongRecord[] = [
  {
    id: 'wr-dose',
    questionId: 'q-dose',
    wrongAnswers: ['b'],
    correctAnswers: ['a'],
    addedAt: '2026-05-20T00:00:00.000Z',
    reviewedCount: 0,
    lastReviewedAt: null,
  },
];

test('rankKnowledgePointsForAI prioritizes query matches, wrong records, and due reviews', () => {
  const dueDate = new Date(Date.now() - 86400000).toISOString();
  const ranked = rankKnowledgePointsForAI({
    query: 'How do I calculate dose conversion?',
    knowledgePoints: [
      kp({ id: 'kp-other', name: 'Unrelated', proficiency: 'master', currentScore: 95 }),
      kp({ id: 'kp-dose', name: 'Dose conversion', proficiency: 'rusty', currentScore: 30 }),
      kp({ id: 'kp-due', name: 'Due review card', nextReviewAt: dueDate, proficiency: 'normal' }),
    ],
    questions,
    wrongRecords,
  });

  expect(ranked[0].knowledgePoint.id).toBe('kp-dose');
  expect(ranked.some(item => item.knowledgePoint.id === 'kp-due')).toBe(true);
});

test('buildAILearningContext caps context and excludes deleted knowledge points', () => {
  const knowledgePoints = Array.from({ length: 12 }, (_, index) =>
    kp({
      id: `kp-${index}`,
      name: `Card ${index}`,
      proficiency: index % 2 === 0 ? 'none' : 'master',
      explanation: 'x'.repeat(500),
      deletedAt: index === 0 ? '2026-05-21T00:00:00.000Z' : null,
    }),
  );

  const context = buildAILearningContext({
    query: 'Card',
    user: { nickname: 'Ada', dailyGoal: 10, dailyNewGoal: 3 } as never,
    subjects: [{ id: 'subject-1', name: 'Pharmacy', icon: '', color: '', knowledgePointCount: 12 }],
    chapters: [{ id: 'chapter-1', subjectId: 'subject-1', name: 'Basics', order: 1 }],
    knowledgePoints,
    questions: [],
    wrongRecords: [],
    todayReviewItems: [],
    todayNewItems: [],
  });

  expect(context.focusKnowledgePoints).toHaveLength(6);
  expect(context.focusKnowledgePoints.some(item => item.id === 'kp-0')).toBe(false);
  expect(context.focusKnowledgePoints.every(item => (item.explanation?.length || 0) <= 183)).toBe(true);
});

test('buildAILearningContext includes explicit and inferred profile within budget', () => {
  const context = buildAILearningContext({
    query: 'dose',
    user: {
      nickname: 'Ada',
      dailyGoal: 10,
      dailyNewGoal: 3,
      learningProfile: {
        goals: ['exam_cram', 'weakness_fix', 'foundation', 'daily_review'],
        studyDirection: 'pharmacy',
        explanationStyle: 'exam_oriented',
        preferredDifficulty: 'challenge',
        practicePreference: 'quiz_then_explain',
        updatedAt: '2026-05-22T00:00:00.000Z',
      },
    } as never,
    subjects: [{ id: 'subject-1', name: 'Pharmacy', icon: '', color: '', knowledgePointCount: 1 }],
    chapters: [{ id: 'chapter-1', subjectId: 'subject-1', name: 'Basics', order: 1 }],
    knowledgePoints: [kp({ id: 'kp-dose', name: 'Dose conversion', proficiency: 'rusty', currentScore: 25 })],
    questions,
    wrongRecords,
    todayReviewItems: [{ knowledgePointId: 'kp-dose', type: 'review', scheduledAt: '2026-05-22', completed: false }],
    todayNewItems: [],
  });

  expect(context.profile.learningProfile?.goals).toHaveLength(3);
  expect(context.profile.learningProfile?.studyDirection).toBe('pharmacy');
  expect(context.profile.inferredProfile?.weakPatterns).toContain('low_mastery');
  expect(context.profile.inferredProfile?.stableWeakAreas.length).toBeLessThanOrEqual(3);
});
