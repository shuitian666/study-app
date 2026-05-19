/**
 * ============================================================================
 * 学习状态管理 - LearningContext
 * ============================================================================
 * 
 * 包含学科、章节、知识点、问题、测验结果、错题记录和复习项目等状态
 * ============================================================================
 */

import { createContext, useContext, useReducer, useEffect, useRef, useMemo, useCallback, type ReactNode } from 'react';
import type {
  Subject, Chapter, KnowledgePoint, KnowledgePointExtended, Question, QuizResult, WrongRecord,
  ReviewItem, LearningStats, ProficiencyLevel, QuestionExplanation, StudyRecord, QuizRecord
} from '@/types';
import { PROFICIENCY_MAP } from '@/types';
import { MOCK_SUBJECTS, MOCK_CHAPTERS, MOCK_KNOWLEDGE_POINTS, MOCK_QUESTIONS } from '@/data/mock';
import { getKnowledgeData, hasKnowledgeData, storeKnowledgeData } from '@/services/indexedDBService';
import { deleteLearningRecords, fetchLearningBootstrap, importLearningBatch, patchLearningProgress } from '@/services/learningSyncService';
import type { LearningBootstrapPayload, LearningProgressRecord } from '@/types/learningSync';
import { buildContentSyncPayload, buildDeleteSyncPayload, buildProgressSyncPayload } from '@/utils/learningSyncPayload';
import { useUser } from './UserContext';

function buildQuestionExplanationSeeds(
  questions: Question[],
  existing: QuestionExplanation[] = []
): QuestionExplanation[] {
  const existingIds = new Set(existing.map(e => e.questionId));
  const now = new Date().toISOString();

  const seeded = questions
    .filter(q => !existingIds.has(q.id) && typeof q.explanation === 'string' && q.explanation.trim().length > 0)
    .map(q => ({
      questionId: q.id,
      explanation: q.explanation,
      createdAt: now,
      updatedAt: now,
      isUserModified: false,
    }));

  return [...existing, ...seeded];
}

function normalizeDefaultKnowledgePoints(
  knowledgePoints: KnowledgePointExtended[]
): KnowledgePointExtended[] {
  return knowledgePoints.map(kp => ({
    ...kp,
    proficiency: 'none',
    lastReviewedAt: null,
    nextReviewAt: null,
    reviewCount: 0,
    studyRecords: [],
    quizRecords: [],
    currentScore: 0,
    fsrsState: 'New',
    fsrsReps: 0,
    fsrsLapses: 0,
    fsrsLearningSteps: 0,
  }));
}

interface ImportedStudySession {
  id: string;
  source: 'import';
  knowledgePointIds: string[];
  subjectId: string;
  chapterId: string;
  importedKnowledgeCount: number;
  importedQuestionCount: number;
  skippedQuestionCount: number;
  createdAt: string;
}

export interface ImportHistoryEntry {
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
  deleteExpiresAt?: string | null;
  deleteGroupId?: string | null;
}

interface ImportHistoryInput {
  source: 'manual' | 'local' | 'cloud';
  label: string;
  createdAt?: string;
  sourceId?: string;
}

const RECYCLE_RETENTION_DAYS = 7;
const DAY_MS = 86400000;

type SoftDeleteFields = {
  deletedAt?: string | null;
  deleteExpiresAt?: string | null;
  deleteGroupId?: string | null;
};

// ---------- State ----------
export interface LearningState {
  subjects: Subject[];
  chapters: Chapter[];
  knowledgePoints: KnowledgePointExtended[];
  questions: Question[];
  quizResults: QuizResult[];
  wrongRecords: WrongRecord[];
  todayReviewItems: ReviewItem[];
  todayNewItems: ReviewItem[];
  questionExplanations: QuestionExplanation[];
  importedStudySession: ImportedStudySession | null;
  importHistory: ImportHistoryEntry[];
  // Undo/Redo history (not persisted, in-memory only)
  _history: LearningState[];
  _historyIndex: number;
  _canUndo: boolean;
  _canRedo: boolean;
  isLoading: boolean;
}

const initialLearningState: LearningState = {
  subjects: MOCK_SUBJECTS,
  chapters: MOCK_CHAPTERS,
  knowledgePoints: normalizeDefaultKnowledgePoints(MOCK_KNOWLEDGE_POINTS),
  questions: MOCK_QUESTIONS,
  quizResults: [],
  wrongRecords: [],
  todayReviewItems: [],
  todayNewItems: [],
  questionExplanations: buildQuestionExplanationSeeds(MOCK_QUESTIONS),
  importedStudySession: null,
  importHistory: [],
  // Undo/Redo (not persisted)
  _history: [],
  _historyIndex: -1,
  _canUndo: false,
  _canRedo: false,
  isLoading: false,
};

// ---------- Actions ----------
type LearningAction =
  | { type: 'ADD_SUBJECT'; payload: Subject }
  | { type: 'ADD_CHAPTER'; payload: Chapter }
  | { type: 'ADD_KNOWLEDGE_POINT'; payload: KnowledgePoint & { importHistory?: ImportHistoryInput } }
  | { type: 'UPDATE_KNOWLEDGE_POINT'; payload: Partial<KnowledgePoint> & { id: string } }
  | { type: 'DELETE_KNOWLEDGE_POINT'; payload: string }
  | { type: 'DELETE_KNOWLEDGE_POINTS'; payload: { ids: string[] } }
  | { type: 'DELETE_IMPORT_BATCH'; payload: { importId?: string; dateKey?: string } }
  | { type: 'RESTORE_IMPORT_BATCH'; payload: { importId: string } }
  | { type: 'PURGE_IMPORT_BATCH'; payload: { importId: string } }
  | { type: 'SET_IMPORTED_STUDY_SESSION'; payload: ImportedStudySession }
  | { type: 'CLEAR_IMPORTED_STUDY_SESSION' }
  | { type: 'UPDATE_PROFICIENCY'; payload: { id: string; proficiency: ProficiencyLevel } }
  | { type: 'ADD_QUIZ_RESULT'; payload: QuizResult }
  | { type: 'ADD_WRONG_RECORD'; payload: WrongRecord }
  | { type: 'REMOVE_WRONG_RECORD'; payload: string }
  | { type: 'SET_REVIEW_ITEMS'; payload: { review: ReviewItem[]; newItems: ReviewItem[] } }
  | { type: 'COMPLETE_REVIEW_ITEM'; payload: string }
  | { type: 'SAVE_QUESTION_EXPLANATION'; payload: QuestionExplanation }
  | { type: 'UPDATE_QUESTION_EXPLANATION'; payload: { questionId: string; explanation: string } }
  | { type: 'DELETE_QUESTION_EXPLANATION'; payload: string }
  | { type: 'AI_ADD_GENERATED_QUESTION'; payload: Question }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RECORD_HISTORY' }
  | { type: 'SET_KNOWLEDGE_DATA'; payload: { subjects: Subject[]; chapters: Chapter[]; knowledgePoints: KnowledgePoint[]; questions: Question[]; importHistory?: ImportHistoryInput } }
  | { type: 'APPLY_LEARNING_BOOTSTRAP'; payload: LearningBootstrapPayload }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'RECORD_FLASHCARD_STUDY'; payload: { knowledgePointId: string; score: number } }
  | { type: 'RECORD_QUIZ_ANSWER'; payload: { knowledgePointId: string; questionId: string; correct: boolean; score: number } }
  | { type: 'UPDATE_KNOWLEDGE_POINT_SCORE'; payload: { id: string; score: number } }
  | { type: 'SET_MEMORY_TIP'; payload: { knowledgePointId: string; tip: string } }
  | { type: 'UPDATE_FSRS_CARD'; payload: { knowledgePointId: string; updates: Partial<KnowledgePointExtended> } }
  | { type: 'RESET_ALL' };

function getImportDateKey(createdAt?: string): string {
  if (!createdAt) {
    return '';
  }

  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) {
    return createdAt.slice(0, 10);
  }

  const year = createdDate.getFullYear();
  const month = String(createdDate.getMonth() + 1).padStart(2, '0');
  const day = String(createdDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isLocalImportedKnowledgePoint(kp: KnowledgePointExtended, dateKey?: string): boolean {
  if (kp.source !== 'import' || !kp.id.startsWith('kp-import-')) {
    return false;
  }

  if (!dateKey) {
    return true;
  }

  return getImportDateKey(kp.createdAt) === dateKey;
}

function createDeleteMeta(now = new Date()) {
  const deletedAt = now.toISOString();
  return {
    deletedAt,
    deleteExpiresAt: new Date(now.getTime() + RECYCLE_RETENTION_DAYS * DAY_MS).toISOString(),
    deleteGroupId: `delete-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

function isDeleted(item: SoftDeleteFields): boolean {
  return Boolean(item.deletedAt);
}

function isExpiredDeleted(item: SoftDeleteFields, now = Date.now()): boolean {
  if (!item.deletedAt || !item.deleteExpiresAt) {
    return false;
  }

  const expiresAt = new Date(item.deleteExpiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

function clearDeleteMeta<T extends SoftDeleteFields>(item: T): T {
  return {
    ...item,
    deletedAt: null,
    deleteExpiresAt: null,
    deleteGroupId: null,
  };
}

function applyDeleteMeta<T extends SoftDeleteFields>(item: T, meta: Required<SoftDeleteFields>): T {
  return {
    ...item,
    deletedAt: meta.deletedAt,
    deleteExpiresAt: meta.deleteExpiresAt,
    deleteGroupId: meta.deleteGroupId,
  };
}

function removeExpiredDeletedState(state: LearningState, now = Date.now()): LearningState {
  const expiredKpIds = new Set(
    state.knowledgePoints
      .filter(kp => isExpiredDeleted(kp, now))
      .map(kp => kp.id)
  );
  const expiredQuestionIds = new Set(
    state.questions
      .filter(question => isExpiredDeleted(question as SoftDeleteFields, now))
      .map(question => question.id)
  );
  state.questions.forEach(question => {
    if (question.knowledgePointId && expiredKpIds.has(question.knowledgePointId)) {
      expiredQuestionIds.add(question.id);
    }
  });

  return {
    ...state,
    knowledgePoints: state.knowledgePoints.filter(kp => !expiredKpIds.has(kp.id)),
    questions: state.questions.filter(question => !expiredQuestionIds.has(question.id)),
    wrongRecords: state.wrongRecords.filter(record => !expiredQuestionIds.has(record.questionId)),
    questionExplanations: state.questionExplanations.filter(explanation => !expiredQuestionIds.has(explanation.questionId)),
    todayReviewItems: state.todayReviewItems.filter(item => !expiredKpIds.has(item.knowledgePointId)),
    todayNewItems: state.todayNewItems.filter(item => !expiredKpIds.has(item.knowledgePointId)),
    importHistory: state.importHistory.filter(entry => !isExpiredDeleted(entry, now)),
  };
}

function getActiveLearningState(state: LearningState): LearningState {
  const activeKpIds = new Set(
    state.knowledgePoints
      .filter(kp => !isDeleted(kp))
      .map(kp => kp.id)
  );
  const activeQuestionIds = new Set(
    state.questions
      .filter(question => {
        const deleted = isDeleted(question as SoftDeleteFields);
        return !deleted && (!question.knowledgePointId || activeKpIds.has(question.knowledgePointId));
      })
      .map(question => question.id)
  );

  return {
    ...state,
    knowledgePoints: state.knowledgePoints.filter(kp => activeKpIds.has(kp.id)),
    questions: state.questions.filter(question => activeQuestionIds.has(question.id)),
    wrongRecords: state.wrongRecords.filter(record => activeQuestionIds.has(record.questionId)),
    todayReviewItems: state.todayReviewItems.filter(item => activeKpIds.has(item.knowledgePointId)),
    todayNewItems: state.todayNewItems.filter(item => activeKpIds.has(item.knowledgePointId)),
  };
}

function normalizeImportSource(source?: string): ImportHistoryEntry['source'] {
  if (source === 'cloud' || source === 'cloud-import') return 'cloud';
  if (source === 'local' || source === 'local-import') return 'local';
  return 'manual';
}

function latestTimestamp(...values: Array<string | null | undefined>): string {
  return values.filter(Boolean).sort().at(-1) || '';
}

function itemTimestamp(item: { updatedAt?: string; createdAt?: string }): string {
  return item.updatedAt || item.createdAt || '';
}

function mergeById<T extends { id: string }>(
  current: T[],
  incoming: T[],
): T[] {
  const byId = new Map(current.map(item => [item.id, item]));

  incoming.forEach(item => {
    const existing = byId.get(item.id);
    const existingTimestamp = existing ? itemTimestamp(existing as { updatedAt?: string; createdAt?: string }) : '';
    const incomingTimestamp = itemTimestamp(item as { updatedAt?: string; createdAt?: string });
    if (!existing || latestTimestamp(existingTimestamp, incomingTimestamp) === incomingTimestamp) {
      byId.set(item.id, { ...existing, ...item });
    }
  });

  return Array.from(byId.values());
}

function mergeByKey<T>(
  current: T[],
  incoming: T[],
  getKey: (item: T) => string,
): T[] {
  const byKey = new Map(current.map(item => [getKey(item), item]));

  incoming.forEach(item => {
    const key = getKey(item);
    const existing = byKey.get(key);
    if (!existing || latestTimestamp(itemTimestamp(existing as { updatedAt?: string; createdAt?: string }), itemTimestamp(item as { updatedAt?: string; createdAt?: string })) === itemTimestamp(item as { updatedAt?: string; createdAt?: string })) {
      byKey.set(key, { ...existing, ...item });
    }
  });

  return Array.from(byKey.values());
}

function mergeProgressIntoKnowledgePoints(
  knowledgePoints: KnowledgePointExtended[],
  progress: LearningProgressRecord[],
): KnowledgePointExtended[] {
  const progressByKpId = new Map(progress.map(record => [record.knowledgePointId, record]));

  return knowledgePoints.map(kp => {
    const progressRecord = progressByKpId.get(kp.id);
    if (!progressRecord || progressRecord.deletedAt) return kp;
    const updates: Partial<LearningProgressRecord> = { ...progressRecord };
    delete updates.id;
    delete updates.knowledgePointId;
    delete updates.ownerUserId;
    delete updates.sourceType;
    return { ...kp, ...updates };
  });
}

function normalizeImportHistory(entries: ImportHistoryEntry[]): ImportHistoryEntry[] {
  return entries.map(entry => ({
    ...entry,
    source: normalizeImportSource(entry.source),
  }));
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

function learningReducer(state: LearningState, action: LearningAction): LearningState {
  switch (action.type) {
    case 'ADD_SUBJECT':
      return { ...state, subjects: [...state.subjects, action.payload] };
    case 'ADD_CHAPTER':
      return { ...state, chapters: [...state.chapters, action.payload] };
    case 'ADD_KNOWLEDGE_POINT': {
      const { importHistory, ...knowledgePoint } = action.payload;
      const nextKnowledgePoint = knowledgePoint as KnowledgePointExtended;
      const nextImportHistory = importHistory
        ? [
            ...state.importHistory,
            {
              id: `import-history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              source: importHistory.source,
              sourceId: importHistory.sourceId,
              createdAt: importHistory.createdAt ?? nextKnowledgePoint.createdAt,
              label: importHistory.label,
              knowledgePointIds: [nextKnowledgePoint.id],
              questionIds: [],
              knowledgeCount: 1,
              questionCount: 0,
            },
          ]
        : state.importHistory;

      return {
        ...state,
        knowledgePoints: [...state.knowledgePoints, nextKnowledgePoint],
        importHistory: nextImportHistory,
      };
    }
    case 'DELETE_KNOWLEDGE_POINT':
      return learningReducer(state, { type: 'DELETE_KNOWLEDGE_POINTS', payload: { ids: [action.payload] } });
    case 'DELETE_KNOWLEDGE_POINTS': {
      const targetIds = new Set(action.payload.ids);
      if (targetIds.size === 0) return state;
      const deleteMeta = createDeleteMeta();
      const affectedQuestionIds = new Set(
        state.questions
          .filter(question => question.knowledgePointId && targetIds.has(question.knowledgePointId))
          .map(question => question.id)
      );

      return {
        ...state,
        knowledgePoints: state.knowledgePoints.map(kp =>
          targetIds.has(kp.id) ? applyDeleteMeta(kp, deleteMeta) : kp
        ),
        questions: state.questions.map(question =>
          affectedQuestionIds.has(question.id) ? applyDeleteMeta(question, deleteMeta) : question
        ),
        todayReviewItems: state.todayReviewItems.filter(item => !targetIds.has(item.knowledgePointId)),
        todayNewItems: state.todayNewItems.filter(item => !targetIds.has(item.knowledgePointId)),
        importHistory: state.importHistory.map(entry => {
          const allDeleted = entry.knowledgePointIds.length > 0 && entry.knowledgePointIds.every(id => targetIds.has(id));
          return allDeleted ? applyDeleteMeta(entry, deleteMeta) : entry;
        }),
      };
    }
    case 'DELETE_IMPORT_BATCH': {
      const historyEntry = action.payload.importId
        ? state.importHistory.find(entry => entry.id === action.payload.importId)
        : undefined;
      const importedBatchIds = new Set(
        historyEntry
          ? historyEntry.knowledgePointIds
          : state.knowledgePoints
              .filter(kp => isLocalImportedKnowledgePoint(kp, action.payload.dateKey))
              .map(kp => kp.id)
      );

      if (importedBatchIds.size === 0) {
        return state;
      }

      const removedQuestionIds = new Set([
        ...(historyEntry?.questionIds ?? []),
        ...state.questions
          .filter(question => question.knowledgePointId && importedBatchIds.has(question.knowledgePointId))
          .map(question => question.id),
      ]);

      const nextImportedStudySession = state.importedStudySession
        ? {
            ...state.importedStudySession,
            knowledgePointIds: state.importedStudySession.knowledgePointIds.filter(id => !importedBatchIds.has(id)),
          }
        : null;

      const deleteMeta = createDeleteMeta();

      return {
        ...state,
        knowledgePoints: state.knowledgePoints.map(kp =>
          importedBatchIds.has(kp.id) ? applyDeleteMeta(kp, deleteMeta) : kp
        ),
        questions: state.questions.map(question =>
          removedQuestionIds.has(question.id) ? applyDeleteMeta(question, deleteMeta) : question
        ),
        todayReviewItems: state.todayReviewItems.filter(item => !importedBatchIds.has(item.knowledgePointId)),
        todayNewItems: state.todayNewItems.filter(item => !importedBatchIds.has(item.knowledgePointId)),
        importedStudySession: nextImportedStudySession && nextImportedStudySession.knowledgePointIds.length > 0
          ? nextImportedStudySession
          : null,
        importHistory: state.importHistory.map(entry => {
          if (historyEntry && entry.id === historyEntry.id) {
            return applyDeleteMeta(entry, deleteMeta);
          }
          if (!action.payload.dateKey || entry.createdAt.slice(0, 10) !== action.payload.dateKey) {
            return entry;
          }
          return applyDeleteMeta(entry, deleteMeta);
        }),
      };
    }
    case 'RESTORE_IMPORT_BATCH': {
      const historyEntry = state.importHistory.find(entry => entry.id === action.payload.importId);
      if (!historyEntry) return state;

      const restoreKpIds = new Set(historyEntry.knowledgePointIds);
      const restoreQuestionIds = new Set(historyEntry.questionIds);
      state.questions.forEach(question => {
        if (question.knowledgePointId && restoreKpIds.has(question.knowledgePointId)) {
          restoreQuestionIds.add(question.id);
        }
      });

      return {
        ...state,
        knowledgePoints: state.knowledgePoints.map(kp =>
          restoreKpIds.has(kp.id) ? clearDeleteMeta(kp) : kp
        ),
        questions: state.questions.map(question =>
          restoreQuestionIds.has(question.id) ? clearDeleteMeta(question) : question
        ),
        importHistory: state.importHistory.map(entry =>
          entry.id === historyEntry.id ? clearDeleteMeta(entry) : entry
        ),
      };
    }
    case 'PURGE_IMPORT_BATCH': {
      const historyEntry = state.importHistory.find(entry => entry.id === action.payload.importId);
      if (!historyEntry) return state;
      const purgeKpIds = new Set(historyEntry.knowledgePointIds);
      const purgeQuestionIds = new Set(historyEntry.questionIds);
      state.questions.forEach(question => {
        if (question.knowledgePointId && purgeKpIds.has(question.knowledgePointId)) {
          purgeQuestionIds.add(question.id);
        }
      });

      return {
        ...state,
        knowledgePoints: state.knowledgePoints.filter(kp => !purgeKpIds.has(kp.id)),
        questions: state.questions.filter(question => !purgeQuestionIds.has(question.id)),
        wrongRecords: state.wrongRecords.filter(record => !purgeQuestionIds.has(record.questionId)),
        questionExplanations: state.questionExplanations.filter(explanation => !purgeQuestionIds.has(explanation.questionId)),
        todayReviewItems: state.todayReviewItems.filter(item => !purgeKpIds.has(item.knowledgePointId)),
        todayNewItems: state.todayNewItems.filter(item => !purgeKpIds.has(item.knowledgePointId)),
        importHistory: state.importHistory.filter(entry => entry.id !== historyEntry.id),
      };
    }
    case 'SET_IMPORTED_STUDY_SESSION':
      return {
        ...state,
        importedStudySession: action.payload,
      };
    case 'CLEAR_IMPORTED_STUDY_SESSION':
      return {
        ...state,
        importedStudySession: null,
      };
    case 'UPDATE_KNOWLEDGE_POINT':
      return {
        ...state,
        knowledgePoints: state.knowledgePoints.map(kp =>
          kp.id === action.payload.id ? { ...kp, ...action.payload } as KnowledgePointExtended : kp
        ),
      };
    case 'UPDATE_PROFICIENCY': {
      const now = new Date().toISOString();
      const interval = PROFICIENCY_MAP[action.payload.proficiency].reviewIntervalDays;
      const nextReview = new Date(Date.now() + interval * 86400000).toISOString();
      return {
        ...state,
        knowledgePoints: state.knowledgePoints.map(kp =>
          kp.id === action.payload.id
            ? {
                ...kp,
                proficiency: action.payload.proficiency,
                lastReviewedAt: now,
                nextReviewAt: nextReview,
                reviewCount: kp.reviewCount + 1,
                masteredAt: action.payload.proficiency === 'master' ? (kp.masteredAt ?? now) : kp.masteredAt,
              }
            : kp
        ),
      };
    }
    case 'ADD_QUIZ_RESULT':
      return { ...state, quizResults: [...state.quizResults, action.payload] };
    case 'ADD_WRONG_RECORD':
      return { ...state, wrongRecords: [...state.wrongRecords, action.payload] };
    case 'REMOVE_WRONG_RECORD':
      return { ...state, wrongRecords: state.wrongRecords.filter(r => r.id !== action.payload) };
    case 'SET_REVIEW_ITEMS':
      return { ...state, todayReviewItems: action.payload.review, todayNewItems: action.payload.newItems };
    case 'COMPLETE_REVIEW_ITEM':
      return {
        ...state,
        todayReviewItems: state.todayReviewItems.map(r =>
          r.knowledgePointId === action.payload ? { ...r, completed: true } : r
        ),
        todayNewItems: state.todayNewItems.map(r =>
          r.knowledgePointId === action.payload ? { ...r, completed: true } : r
        ),
      };
    case 'SAVE_QUESTION_EXPLANATION': {
      const exists = state.questionExplanations.find(e => e.questionId === action.payload.questionId);
      if (exists) return state;
      return {
        ...state,
        questionExplanations: [...state.questionExplanations, action.payload],
      };
    }
    case 'UPDATE_QUESTION_EXPLANATION':
      return {
        ...state,
        questionExplanations: state.questionExplanations.map(e =>
          e.questionId === action.payload.questionId
            ? { ...e, explanation: action.payload.explanation, updatedAt: new Date().toISOString(), isUserModified: true }
            : e
        ),
      };
    case 'DELETE_QUESTION_EXPLANATION':
      return {
        ...state,
        questionExplanations: state.questionExplanations.filter(e => e.questionId !== action.payload),
      };
    case 'AI_ADD_GENERATED_QUESTION':
      return { ...state, questions: [...state.questions, action.payload] };
    case 'RECORD_HISTORY': {
      // Only record certain actions for undo (not navigation, not undo/redo)
      const newHistory = state._history.slice(0, state._historyIndex + 1);
      newHistory.push({
        subjects: state.subjects,
        chapters: state.chapters,
        knowledgePoints: state.knowledgePoints,
        questions: state.questions,
        wrongRecords: state.wrongRecords,
        todayReviewItems: state.todayReviewItems,
        todayNewItems: state.todayNewItems,
        questionExplanations: state.questionExplanations,
        importedStudySession: state.importedStudySession,
        importHistory: state.importHistory,
      } as LearningState);
      // Keep only last 50 history entries
      if (newHistory.length > 50) newHistory.shift();
      return {
        ...state,
        _history: newHistory,
        _historyIndex: newHistory.length - 1,
        _canUndo: newHistory.length > 1,
        _canRedo: false,
      };
    }
    case 'UNDO': {
      if (state._historyIndex <= 0 || state._history.length === 0) return state;
      const prevState = state._history[state._historyIndex - 1];
      const newHistoryIndex = state._historyIndex - 1;
      return {
        ...state,
        ...prevState,
        _history: state._history,
        _historyIndex: newHistoryIndex,
        _canUndo: newHistoryIndex > 0,
        _canRedo: true,
      };
    }
    case 'REDO': {
      if (state._historyIndex >= state._history.length - 1) return state;
      const nextState = state._history[state._historyIndex + 1];
      const newHistoryIndex = state._historyIndex + 1;
      return {
        ...state,
        ...nextState,
        _history: state._history,
        _historyIndex: newHistoryIndex,
        _canUndo: true,
        _canRedo: newHistoryIndex < state._history.length - 1,
      };
    }
    case 'SET_KNOWLEDGE_DATA': {
      // 合并知识库数据：下载的数据与现有数据合并（按ID去重）
      const existingKPIds = new Set(state.knowledgePoints.filter(kp => !isDeleted(kp)).map(kp => kp.id));
      const newKPIds = new Set(action.payload.knowledgePoints.map(kp => kp.id));
      const importCreatedAt = action.payload.importHistory?.createdAt ?? new Date().toISOString();

      // 找出本地有但下载数据没有的（保留本地独有的）
      const localOnlyKP = state.knowledgePoints.filter(kp => !newKPIds.has(kp.id));
      // 找出下载有但本地没有的（新增的）
      const newOnlyKP = action.payload.knowledgePoints
        .filter(kp => !existingKPIds.has(kp.id))
        .map(kp => ({
          ...kp,
          createdAt: kp.createdAt || importCreatedAt,
          source: kp.source ?? 'import',
        })) as KnowledgePointExtended[];
      // 合并：本地独有 + (本地和下载都有的，用下载的更新) + 下载独有的
      const mergedKP = [
        ...localOnlyKP,
        ...state.knowledgePoints.filter(kp => newKPIds.has(kp.id) && !isDeleted(kp)).map(existing => {
          const downloaded = action.payload.knowledgePoints.find(kp => kp.id === existing.id);
          return downloaded ? { ...existing, ...downloaded } as KnowledgePointExtended : existing;
        }),
        ...newOnlyKP
      ];

      // 同样合并 subjects 和 chapters
      const existingSubjectIds = new Set(state.subjects.map(s => s.id));
      const mergedSubjects = [
        ...state.subjects,
        ...action.payload.subjects.filter(s => !existingSubjectIds.has(s.id))
      ];

      const existingChapterIds = new Set(state.chapters.map(c => c.id));
      const mergedChapters = [
        ...state.chapters,
        ...action.payload.chapters.filter(c => !existingChapterIds.has(c.id))
      ];

      // 合并 questions
      const existingQuestionIds = new Set(state.questions.filter(q => !isDeleted(q as SoftDeleteFields)).map(q => q.id));
      const newOnlyQuestions = action.payload.questions.filter(q => !existingQuestionIds.has(q.id));
      const mergedQuestions = [
        ...state.questions,
        ...newOnlyQuestions
      ];

      const mergedQuestionExplanations = buildQuestionExplanationSeeds(
        mergedQuestions,
        state.questionExplanations
      );
      const nextImportHistory = action.payload.importHistory && newOnlyKP.length > 0
        ? [
            ...state.importHistory,
            {
              id: `import-history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              source: action.payload.importHistory.source,
              sourceId: action.payload.importHistory.sourceId,
              createdAt: importCreatedAt,
              label: action.payload.importHistory.label,
              knowledgePointIds: newOnlyKP.map(kp => kp.id),
              questionIds: newOnlyQuestions.map(question => question.id),
              knowledgeCount: newOnlyKP.length,
              questionCount: newOnlyQuestions.length,
            },
          ]
        : state.importHistory;

      return {
        ...state,
        subjects: mergedSubjects,
        chapters: mergedChapters,
        knowledgePoints: mergedKP,
        questions: mergedQuestions,
        questionExplanations: mergedQuestionExplanations,
        importHistory: nextImportHistory,
      };
    }
    case 'APPLY_LEARNING_BOOTSTRAP': {
      const payload = action.payload;
      const mergedSubjects = mergeById(state.subjects, payload.subjects);
      const mergedChapters = mergeById(state.chapters, payload.chapters);
      const mergedQuestions = mergeById(state.questions, payload.questions);
      const mergedKnowledgePoints = mergeProgressIntoKnowledgePoints(
        mergeById(state.knowledgePoints, payload.knowledgePoints) as KnowledgePointExtended[],
        payload.progress,
      );
      const mergedQuestionExplanations = buildQuestionExplanationSeeds(
        mergedQuestions,
        mergeByKey(state.questionExplanations, payload.questionExplanations, item => item.questionId),
      );

      return removeExpiredDeletedState({
        ...state,
        subjects: mergedSubjects,
        chapters: mergedChapters,
        knowledgePoints: mergedKnowledgePoints,
        questions: mergedQuestions,
        wrongRecords: mergeById(state.wrongRecords, payload.wrongRecords),
        questionExplanations: mergedQuestionExplanations,
        importHistory: mergeById(state.importHistory, normalizeImportHistory(payload.importHistory)),
      });
    }
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    case 'RECORD_FLASHCARD_STUDY': {
      const { knowledgePointId, score } = action.payload;
      const now = new Date().toISOString();
      return {
        ...state,
        knowledgePoints: state.knowledgePoints.map(kp => {
          if (kp.id !== knowledgePointId) return kp;
          const newRecord: StudyRecord = { date: now, type: 'flashcard', score, knowledgePointId };
          const studyRecords = [...(kp.studyRecords || []), newRecord];
          const newScore = kp.currentScore
            ? kp.currentScore * 0.5 + score * 0.5
            : score;
          return { ...kp, studyRecords, currentScore: newScore };
        }),
      };
    }
    case 'RECORD_QUIZ_ANSWER': {
      const { knowledgePointId, questionId, correct, score } = action.payload;
      const now = new Date().toISOString();
      return {
        ...state,
        knowledgePoints: state.knowledgePoints.map(kp => {
          if (kp.id !== knowledgePointId) return kp;
          const newRecord: QuizRecord = { date: now, questionId, correct, score, knowledgePointId };
          const quizRecords = [...(kp.quizRecords || []), newRecord];
          const newScore = kp.currentScore
            ? kp.currentScore * 0.5 + score * 0.5
            : score;
          return { ...kp, quizRecords, currentScore: newScore };
        }),
      };
    }
    case 'UPDATE_KNOWLEDGE_POINT_SCORE': {
      return {
        ...state,
        knowledgePoints: state.knowledgePoints.map(kp =>
          kp.id === action.payload.id
            ? { ...kp, currentScore: action.payload.score }
            : kp
        ),
      };
    }
    case 'SET_MEMORY_TIP': {
      return {
        ...state,
        knowledgePoints: state.knowledgePoints.map(kp =>
          kp.id === action.payload.knowledgePointId
            ? { ...kp, memoryTip: action.payload.tip }
            : kp
        ),
      };
    }
    case 'UPDATE_FSRS_CARD': {
      return {
        ...state,
        knowledgePoints: state.knowledgePoints.map(kp =>
          kp.id === action.payload.knowledgePointId
            ? { ...kp, ...action.payload.updates }
            : kp
        ),
      };
    }
    case 'RESET_ALL':
      return initialLearningState;
    default:
      return state;
  }
}

// ---------- Action Creators ----------
export function recordFlashcardStudy(knowledgePointId: string, score: number) {
  return { type: 'RECORD_FLASHCARD_STUDY', payload: { knowledgePointId, score } };
}

export function recordQuizAnswer(knowledgePointId: string, questionId: string, correct: boolean, score: number) {
  return { type: 'RECORD_QUIZ_ANSWER', payload: { knowledgePointId, questionId, correct, score } };
}

export function updateKnowledgePointScore(id: string, score: number) {
  return { type: 'UPDATE_KNOWLEDGE_POINT_SCORE', payload: { id, score } };
}

export function setMemoryTip(knowledgePointId: string, tip: string) {
  return { type: 'SET_MEMORY_TIP', payload: { knowledgePointId, tip } };
}

// FSRS 相关 Action
export function updateFsrsCard(
  knowledgePointId: string,
  updates: Partial<Pick<
    KnowledgePointExtended,
    'fsrsStability' | 'fsrsDifficulty' | 'fsrsState' |
    'fsrsLearningSteps' | 'fsrsLapses' | 'fsrsReps' |
    'nextReviewAt' | 'lastReviewedAt'
  >>
) {
  return {
    type: 'UPDATE_FSRS_CARD',
    payload: { knowledgePointId, updates }
  };
}

// ---------- Context ----------
interface LearningContextType {
  learningState: LearningState;
  learningDispatch: React.Dispatch<LearningAction>;
  getLearningStats: () => LearningStats;
  getTaskCompletionRate: () => { done: number; total: number; rate: number };
  undo: () => void;
  redo: () => void;
  recordHistory: () => void;
  _canUndo: boolean;
  _canRedo: boolean;
}

const LearningContext = createContext<LearningContextType | null>(null);

// 加载持久化数据?
function getInitialLearningState(): LearningState {
  return removeExpiredDeletedState(initialLearningState);
}

export function LearningProvider({ children }: { children: ReactNode }) {
  const [learningState, learningDispatch] = useReducer(learningReducer, undefined, getInitialLearningState);
  const { userState } = useUser();
  const isFirstRender = useRef(true);
  const isIndexedDBLoaded = useRef(false);
  const cloudBootstrapUserId = useRef<string | null>(null);
  const cloudBootstrapReadyUserId = useRef<string | null>(null);
  const lastContentSyncHash = useRef<string>('');
  const lastProgressSyncHash = useRef<string>('');
  const lastDeleteSyncHash = useRef<string>('');

  // 鍔犺浇IndexedDB涓殑鐭ヨ瘑搴撴暟鎹?
  useEffect(() => {
    let isCancelled = false;

    const loadKnowledgeData = async () => {
      try {
        if (!isCancelled) {
          learningDispatch({ type: 'SET_LOADING', payload: true });
        }
        const hasData = await hasKnowledgeData();
        if (hasData) {
          const data = await getKnowledgeData();
          if (!isCancelled) {
            learningDispatch({
              type: 'SET_KNOWLEDGE_DATA',
              payload: data
            });
          }
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load knowledge data from IndexedDB:', error);
        }
      } finally {
        if (!isCancelled) {
          learningDispatch({ type: 'SET_LOADING', payload: false });
          isIndexedDBLoaded.current = true;
        }
      }
    };

    if (isFirstRender.current) {
      loadKnowledgeData();
      isFirstRender.current = false;
    }

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const userId = userState.user?.id;
    if (!userState.isLoggedIn || !userId) {
      cloudBootstrapUserId.current = null;
      cloudBootstrapReadyUserId.current = null;
      lastContentSyncHash.current = '';
      lastProgressSyncHash.current = '';
      lastDeleteSyncHash.current = '';
      return;
    }
    if (cloudBootstrapUserId.current === userId) return;

    let isCancelled = false;
    cloudBootstrapUserId.current = userId;
    cloudBootstrapReadyUserId.current = null;

    const loadCloudBootstrap = async () => {
      try {
        learningDispatch({ type: 'SET_LOADING', payload: true });
        const bootstrap = await fetchLearningBootstrap();
        if (!isCancelled) {
          learningDispatch({ type: 'APPLY_LEARNING_BOOTSTRAP', payload: bootstrap });
        }
      } catch (error) {
        if (!isCancelled && (error as Error & { status?: number }).status !== 401) {
          console.error('Failed to load learning bootstrap:', error);
        }
      } finally {
        if (!isCancelled) {
          learningDispatch({ type: 'SET_LOADING', payload: false });
          cloudBootstrapReadyUserId.current = userId;
        }
      }
    };

    loadCloudBootstrap();

    return () => {
      isCancelled = true;
    };
  }, [userState.isLoggedIn, userState.user?.id]);

  useEffect(() => {
    const userId = userState.user?.id;
    if (!userState.isLoggedIn || !userId || cloudBootstrapReadyUserId.current !== userId) return;

    const payload = buildContentSyncPayload(learningState);
    if (!payload) return;

    const hash = stableStringify(payload);
    if (hash === lastContentSyncHash.current) return;

    const timeoutId = window.setTimeout(() => {
      importLearningBatch(payload)
        .then(() => {
          lastContentSyncHash.current = hash;
        })
        .catch(error => {
          if ((error as Error & { status?: number }).status !== 401) {
            console.error('Failed to sync learning content:', error);
          }
        });
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [
    learningState.subjects,
    learningState.chapters,
    learningState.knowledgePoints,
    learningState.questions,
    learningState.importHistory,
    userState.isLoggedIn,
    userState.user?.id,
  ]);

  useEffect(() => {
    const userId = userState.user?.id;
    if (!userState.isLoggedIn || !userId || cloudBootstrapReadyUserId.current !== userId) return;

    const payload = buildProgressSyncPayload(learningState);
    if (!payload) return;

    const hash = stableStringify(payload);
    if (hash === lastProgressSyncHash.current) return;

    const timeoutId = window.setTimeout(() => {
      patchLearningProgress(payload)
        .then(() => {
          lastProgressSyncHash.current = hash;
        })
        .catch(error => {
          if ((error as Error & { status?: number }).status !== 401) {
            console.error('Failed to sync learning progress:', error);
          }
        });
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [
    learningState.knowledgePoints,
    learningState.wrongRecords,
    learningState.questionExplanations,
    userState.isLoggedIn,
    userState.user?.id,
  ]);

  useEffect(() => {
    const userId = userState.user?.id;
    if (!userState.isLoggedIn || !userId || cloudBootstrapReadyUserId.current !== userId) return;

    const payload = buildDeleteSyncPayload(learningState);
    if (!payload) return;

    const hash = stableStringify(payload);
    if (hash === lastDeleteSyncHash.current) return;

    const timeoutId = window.setTimeout(() => {
      deleteLearningRecords(payload)
        .then(() => {
          lastDeleteSyncHash.current = hash;
        })
        .catch(error => {
          if ((error as Error & { status?: number }).status !== 401) {
            console.error('Failed to sync learning deletes:', error);
          }
        });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [
    learningState.knowledgePoints,
    learningState.questions,
    learningState.importHistory,
    userState.isLoggedIn,
    userState.user?.id,
  ]);


  // 当知识库数据变化时，同步到IndexedDB
  useEffect(() => {
    let isCancelled = false;

    const saveKnowledgeData = async () => {
      try {
        await storeKnowledgeData({
          subjects: learningState.subjects,
          chapters: learningState.chapters,
          knowledgePoints: learningState.knowledgePoints,
          questions: learningState.questions,
        });
      } catch (error) {
        if (!isCancelled) {
          console.error('[IndexedDB] Failed to save knowledge data:', error);
        }
      }
    };

    if (!isFirstRender.current && isIndexedDBLoaded.current) {
      saveKnowledgeData();
    }

    return () => {
      isCancelled = true;
    };
  }, [learningState.subjects, learningState.chapters, learningState.knowledgePoints, learningState.questions]);

  const getLearningStats = useCallback((): LearningStats => {
    const activeState = getActiveLearningState(learningState);
    const kps = activeState.knowledgePoints;
    const masteredCount = kps.filter(k => k.proficiency === 'master').length;
    const normalCount = kps.filter(k => k.proficiency === 'normal').length;
    const rustyCount = kps.filter(k => k.proficiency === 'rusty').length;
    const noneCount = kps.filter(k => k.proficiency === 'none').length;

    const totalQuizzes = learningState.quizResults.length;
    const averageScore = totalQuizzes > 0
      ? Math.round(learningState.quizResults.reduce((sum, q) => sum + q.score, 0) / totalQuizzes)
      : 0;

    const subjectScores: Record<string, { total: number; count: number }> = {};
    const profValues: Record<ProficiencyLevel, number> = { none: 0, rusty: 1, normal: 2, master: 3 };
    kps.forEach(kp => {
      if (!subjectScores[kp.subjectId]) subjectScores[kp.subjectId] = { total: 0, count: 0 };
      subjectScores[kp.subjectId].total += profValues[kp.proficiency];
      subjectScores[kp.subjectId].count += 1;
    });

    const weakSubjects = Object.entries(subjectScores)
      .filter(([, v]) => v.count > 0 && v.total / v.count < 1.5)
      .map(([id]) => learningState.subjects.find(s => s.id === id)?.name ?? id);

    return {
      totalKnowledgePoints: kps.length,
      masteredCount,
      normalCount,
      rustyCount,
      noneCount,
      totalQuizzes,
      averageScore,
      streakDays: 0, // 从UserContext获取
      weakSubjects,
    };
  }, [learningState]);

  const getTaskCompletionRate = useCallback(() => {
    const allTasks = [...learningState.todayReviewItems, ...learningState.todayNewItems];
    const total = allTasks.length;
    const done = allTasks.filter(t => t.completed).length;
    const rate = total === 0 ? 1 : done / total;
    return { done, total, rate };
  }, [learningState.todayReviewItems, learningState.todayNewItems]);

  const undo = useCallback(() => {
    if (learningState._canUndo) {
      learningDispatch({ type: 'UNDO' });
    }
  }, [learningState._canUndo, learningDispatch]);

  const redo = useCallback(() => {
    if (learningState._canRedo) {
      learningDispatch({ type: 'REDO' });
    }
  }, [learningState._canRedo, learningDispatch]);

  const recordHistory = useCallback(() => {
    learningDispatch({ type: 'RECORD_HISTORY' });
  }, [learningDispatch]);

  const publicLearningState = useMemo(() => getActiveLearningState(learningState), [learningState]);

  const contextValue = useMemo(() => ({
    learningState: publicLearningState,
    learningDispatch,
    getLearningStats,
    getTaskCompletionRate,
    undo,
    redo,
    recordHistory,
    _canUndo: learningState._canUndo,
    _canRedo: learningState._canRedo
  }), [
    publicLearningState,
    learningDispatch,
    getLearningStats,
    getTaskCompletionRate,
    undo,
    redo,
    recordHistory,
    learningState._canUndo,
    learningState._canRedo,
  ]);

  return (
    <LearningContext.Provider value={contextValue}>
      {children}
    </LearningContext.Provider>
  );
}

export function useLearning() {
  const ctx = useContext(LearningContext);
  if (!ctx) throw new Error('useLearning must be used within LearningProvider');
  return ctx;
}
