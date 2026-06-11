import { MOCK_CHAPTERS, MOCK_KNOWLEDGE_POINTS, MOCK_QUESTIONS, MOCK_SUBJECTS } from '@/data/mock';
import type { Chapter, KnowledgePointExtended, Question, QuestionExplanation, Subject, WrongRecord } from '@/types';
import type { LearningDeletePayload, LearningImportBatchPayload, LearningProgressPatch } from '@/types/learningSync';

export interface LearningSyncState {
  subjects: Subject[];
  chapters: Chapter[];
  knowledgePoints: KnowledgePointExtended[];
  questions: Question[];
  wrongRecords: WrongRecord[];
  questionExplanations: QuestionExplanation[];
  importHistory: Array<{
    id: string;
    source: 'manual' | 'local' | 'cloud';
    createdAt: string;
    label: string;
    knowledgePointIds: string[];
    questionIds: string[];
    knowledgeCount: number;
    questionCount: number;
    sourceId?: string;
    deletedAt?: string | null;
  }>;
}

const BUILTIN_SUBJECT_IDS = new Set(MOCK_SUBJECTS.map(subject => subject.id));
const BUILTIN_CHAPTER_IDS = new Set(MOCK_CHAPTERS.map(chapter => chapter.id));
const BUILTIN_KNOWLEDGE_POINT_IDS = new Set(MOCK_KNOWLEDGE_POINTS.map(kp => kp.id));
const BUILTIN_QUESTION_IDS = new Set(MOCK_QUESTIONS.map(question => question.id));

function latestTimestamp(...values: Array<string | null | undefined>): string {
  return values.filter(Boolean).sort().at(-1) || '';
}

function isPrivateImportEntry(entry: LearningSyncState['importHistory'][number]): boolean {
  return !entry.deletedAt && (entry.source === 'manual' || entry.source === 'local');
}

export function buildContentSyncPayload(state: LearningSyncState): LearningImportBatchPayload | null {
  const privateHistory = state.importHistory.filter(isPrivateImportEntry);
  const privateKpIds = new Set(privateHistory.flatMap(entry => entry.knowledgePointIds));
  const privateQuestionIds = new Set(privateHistory.flatMap(entry => entry.questionIds));

  state.knowledgePoints.forEach(kp => {
    if (kp.source === 'manual' || kp.source === 'ai' || kp.id.startsWith('kp-import-')) {
      privateKpIds.add(kp.id);
    }
  });

  state.questions.forEach(question => {
    if (
      (
        (question.knowledgePointId && privateKpIds.has(question.knowledgePointId))
        || question.id.startsWith('ai-practice-')
        || question.id.startsWith('ai-synthesis-')
      ) &&
      !BUILTIN_QUESTION_IDS.has(question.id)
    ) {
      privateQuestionIds.add(question.id);
    }
  });

  const knowledgePoints = state.knowledgePoints.filter(kp => privateKpIds.has(kp.id) && !BUILTIN_KNOWLEDGE_POINT_IDS.has(kp.id));
  const questions = state.questions.filter(question => privateQuestionIds.has(question.id) && !BUILTIN_QUESTION_IDS.has(question.id));
  if (knowledgePoints.length === 0 && questions.length === 0 && privateHistory.length === 0) {
    return null;
  }

  const subjectIds = new Set(knowledgePoints.map(kp => kp.subjectId));
  const chapterIds = new Set(knowledgePoints.map(kp => kp.chapterId));
  const subjects = state.subjects.filter(subject => subjectIds.has(subject.id) && !BUILTIN_SUBJECT_IDS.has(subject.id));
  const chapters = state.chapters.filter(chapter => chapterIds.has(chapter.id) && !BUILTIN_CHAPTER_IDS.has(chapter.id));

  return {
    importId: 'client-private-content',
    sourceType: 'local-import',
    label: 'Client private content',
    subjects,
    chapters,
    knowledgePoints,
    questions,
    importHistory: privateHistory,
  };
}

export function buildProgressSyncPayload(state: LearningSyncState): LearningProgressPatch | null {
  const progress = state.knowledgePoints.map(kp => {
    const latestStudyRecord = kp.studyRecords?.at(-1)?.date;
    const latestQuizRecord = kp.quizRecords?.at(-1)?.date;
    const updatedAt = latestTimestamp(kp.lastReviewedAt, latestStudyRecord, latestQuizRecord, kp.createdAt) || new Date(0).toISOString();

    return {
      id: `progress-${kp.id}`,
      knowledgePointId: kp.id,
      proficiency: kp.proficiency,
      lastReviewedAt: kp.lastReviewedAt,
      nextReviewAt: kp.nextReviewAt,
      reviewCount: kp.reviewCount,
      studyRecords: kp.studyRecords,
      quizRecords: kp.quizRecords,
      currentScore: kp.currentScore,
      fsrsStability: kp.fsrsStability,
      fsrsDifficulty: kp.fsrsDifficulty,
      fsrsState: kp.fsrsState,
      fsrsLearningSteps: kp.fsrsLearningSteps,
      fsrsLapses: kp.fsrsLapses,
      fsrsReps: kp.fsrsReps,
      updatedAt,
      deletedAt: kp.deletedAt,
    };
  });

  const questionExplanations = state.questionExplanations.filter(explanation => explanation.isUserModified);
  if (progress.length === 0 && state.wrongRecords.length === 0 && questionExplanations.length === 0) {
    return null;
  }

  return {
    progress,
    wrongRecords: state.wrongRecords,
    questionExplanations,
  };
}

export function buildDeleteSyncPayload(state: LearningSyncState): LearningDeletePayload | null {
  const privateKpIds = new Set(
    state.knowledgePoints
      .filter(kp => (kp.source === 'manual' || kp.source === 'ai' || kp.id.startsWith('kp-import-')) && kp.deletedAt)
      .map(kp => kp.id)
  );
  const privateQuestionIds = new Set(
    state.questions
      .filter(question => {
        if (!question.deletedAt) return false;
        if (question.knowledgePointId && privateKpIds.has(question.knowledgePointId)) return true;
        return question.id.startsWith('q-import-');
      })
      .map(question => question.id)
  );
  const deletedImportHistoryIds = state.importHistory
    .filter(entry => entry.deletedAt && (entry.source === 'manual' || entry.source === 'local'))
    .map(entry => entry.id);
  const deletedAt = latestTimestamp(
    ...state.knowledgePoints.filter(kp => privateKpIds.has(kp.id)).map(kp => kp.deletedAt),
    ...state.questions.filter(question => privateQuestionIds.has(question.id)).map(question => question.deletedAt),
    ...state.importHistory.filter(entry => deletedImportHistoryIds.includes(entry.id)).map(entry => entry.deletedAt),
  );

  if (privateKpIds.size === 0 && privateQuestionIds.size === 0 && deletedImportHistoryIds.length === 0) {
    return null;
  }

  return {
    deletedAt: deletedAt || new Date().toISOString(),
    records: {
      knowledgePoints: Array.from(privateKpIds),
      questions: Array.from(privateQuestionIds),
      importHistory: deletedImportHistoryIds,
    },
  };
}
