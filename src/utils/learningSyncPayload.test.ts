import { MOCK_CHAPTERS, MOCK_KNOWLEDGE_POINTS, MOCK_QUESTIONS, MOCK_SUBJECTS } from '@/data/mock';
import type { Chapter, KnowledgePointExtended, Question, Subject } from '@/types';
import {
  buildContentSyncPayload,
  buildDeleteSyncPayload,
  buildProgressSyncPayload,
  type LearningSyncState,
} from './learningSyncPayload';

function baseState(overrides: Partial<LearningSyncState> = {}): LearningSyncState {
  return {
    subjects: MOCK_SUBJECTS,
    chapters: MOCK_CHAPTERS,
    knowledgePoints: MOCK_KNOWLEDGE_POINTS,
    questions: MOCK_QUESTIONS,
    wrongRecords: [],
    questionExplanations: [],
    importHistory: [],
    ...overrides,
  };
}

function privateKnowledgePoint(overrides: Partial<KnowledgePointExtended> = {}): KnowledgePointExtended {
  return {
    id: 'kp-private',
    subjectId: 'subject-private',
    chapterId: 'chapter-private',
    name: 'Private point',
    explanation: 'Private explanation',
    proficiency: 'none',
    lastReviewedAt: null,
    nextReviewAt: null,
    reviewCount: 0,
    createdAt: '2026-05-18T00:00:00.000Z',
    source: 'manual',
    studyRecords: [],
    quizRecords: [],
    currentScore: 0,
    fsrsState: 'New',
    fsrsReps: 0,
    fsrsLapses: 0,
    fsrsLearningSteps: 0,
    ...overrides,
  };
}

function privateQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q-private',
    knowledgePointId: 'kp-private',
    subjectId: 'subject-private',
    chapterId: 'chapter-private',
    type: 'single_choice',
    stem: 'Stem',
    options: [{ id: 'a', text: 'A' }],
    correctAnswers: ['a'],
    explanation: '',
    ...overrides,
  };
}

describe('learning sync payload builders', () => {
  test('content sync ignores built-in mock content', () => {
    expect(buildContentSyncPayload(baseState())).toBeNull();
  });

  test('content sync includes private knowledge and related question', () => {
    const subject: Subject = { id: 'subject-private', name: 'Private', icon: 'P', color: '#000', knowledgePointCount: 1 };
    const chapter: Chapter = { id: 'chapter-private', subjectId: subject.id, name: 'Private chapter', order: 1 };
    const payload = buildContentSyncPayload(baseState({
      subjects: [...MOCK_SUBJECTS, subject],
      chapters: [...MOCK_CHAPTERS, chapter],
      knowledgePoints: [...MOCK_KNOWLEDGE_POINTS, privateKnowledgePoint()],
      questions: [...MOCK_QUESTIONS, privateQuestion()],
      importHistory: [{
        id: 'import-private',
        source: 'manual',
        createdAt: '2026-05-18T00:00:00.000Z',
        label: 'Private import',
        knowledgePointIds: ['kp-private'],
        questionIds: ['q-private'],
        knowledgeCount: 1,
        questionCount: 1,
      }],
    }));

    expect(payload?.knowledgePoints?.map(item => item.id)).toEqual(['kp-private']);
    expect(payload?.questions?.map(item => item.id)).toEqual(['q-private']);
    expect(payload?.subjects?.map(item => item.id)).toEqual(['subject-private']);
    expect(payload?.chapters?.map(item => item.id)).toEqual(['chapter-private']);
  });

  test('content sync includes completed AI-generated knowledge without import history', () => {
    const subject: Subject = { id: 'subject-ai', name: 'Physical Chemistry', icon: 'P', color: '#4f46e5', knowledgePointCount: 1 };
    const chapter: Chapter = { id: 'chapter-ai', subjectId: subject.id, name: 'Thermodynamics', order: 1 };
    const knowledgePoint = privateKnowledgePoint({
      id: 'kp-ai',
      subjectId: subject.id,
      chapterId: chapter.id,
      source: 'ai',
    });
    const question = privateQuestion({
      id: 'q-ai',
      knowledgePointId: knowledgePoint.id,
      subjectId: subject.id,
      chapterId: chapter.id,
    });
    const payload = buildContentSyncPayload(baseState({
      subjects: [...MOCK_SUBJECTS, subject],
      chapters: [...MOCK_CHAPTERS, chapter],
      knowledgePoints: [...MOCK_KNOWLEDGE_POINTS, knowledgePoint],
      questions: [...MOCK_QUESTIONS, question],
    }));

    expect(payload?.knowledgePoints?.map(item => item.id)).toEqual(['kp-ai']);
    expect(payload?.questions?.map(item => item.id)).toEqual(['q-ai']);
    expect(payload?.subjects?.map(item => item.id)).toEqual(['subject-ai']);
    expect(payload?.chapters?.map(item => item.id)).toEqual(['chapter-ai']);
  });

  test('content sync includes AI practice attached to an existing knowledge point', () => {
    const existingKnowledgePoint = MOCK_KNOWLEDGE_POINTS[0];
    const payload = buildContentSyncPayload(baseState({
      questions: [
        ...MOCK_QUESTIONS,
        privateQuestion({
          id: `ai-practice-${existingKnowledgePoint.id}-1`,
          knowledgePointId: existingKnowledgePoint.id,
          subjectId: existingKnowledgePoint.subjectId,
          chapterId: existingKnowledgePoint.chapterId,
        }),
      ],
    }));

    expect(payload?.knowledgePoints).toEqual([]);
    expect(payload?.questions?.map(item => item.id)).toEqual([
      `ai-practice-${existingKnowledgePoint.id}-1`,
    ]);
  });

  test('progress sync includes FSRS fields and user-modified explanations', () => {
    const payload = buildProgressSyncPayload(baseState({
      knowledgePoints: [privateKnowledgePoint({
        proficiency: 'normal',
        lastReviewedAt: '2026-05-19T00:00:00.000Z',
        fsrsState: 'Review',
        fsrsReps: 3,
      })],
      questionExplanations: [{
        questionId: 'q-private',
        explanation: 'Edited',
        createdAt: '2026-05-18T00:00:00.000Z',
        updatedAt: '2026-05-19T00:00:00.000Z',
        isUserModified: true,
      }],
    }));

    expect(payload?.progress?.[0]).toMatchObject({
      knowledgePointId: 'kp-private',
      proficiency: 'normal',
      fsrsState: 'Review',
      fsrsReps: 3,
    });
    expect(payload?.questionExplanations).toHaveLength(1);
  });

  test('delete sync only includes private deleted records', () => {
    const payload = buildDeleteSyncPayload(baseState({
      knowledgePoints: [
        MOCK_KNOWLEDGE_POINTS[0],
        privateKnowledgePoint({ deletedAt: '2026-05-19T00:00:00.000Z' }),
      ],
      questions: [
        MOCK_QUESTIONS[0],
        privateQuestion({ deletedAt: '2026-05-19T00:00:00.000Z' }),
      ],
    }));

    expect(payload?.records?.knowledgePoints).toEqual(['kp-private']);
    expect(payload?.records?.questions).toEqual(['q-private']);
  });
});
