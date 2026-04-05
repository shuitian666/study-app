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
import { saveState, loadState } from './persistence';
import { getKnowledgeData, hasKnowledgeData, storeKnowledgeData } from '@/services/indexedDBService';

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
  knowledgePoints: MOCK_KNOWLEDGE_POINTS,
  questions: MOCK_QUESTIONS,
  quizResults: [],
  wrongRecords: [],
  todayReviewItems: [],
  todayNewItems: [],
  questionExplanations: [],
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
  | { type: 'ADD_KNOWLEDGE_POINT'; payload: KnowledgePoint }
  | { type: 'UPDATE_KNOWLEDGE_POINT'; payload: Partial<KnowledgePoint> & { id: string } }
  | { type: 'DELETE_KNOWLEDGE_POINT'; payload: string }
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
  | { type: 'SET_KNOWLEDGE_DATA'; payload: { subjects: Subject[]; chapters: Chapter[]; knowledgePoints: KnowledgePoint[]; questions: Question[] } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'RECORD_FLASHCARD_STUDY'; payload: { knowledgePointId: string; score: number } }
  | { type: 'RECORD_QUIZ_ANSWER'; payload: { knowledgePointId: string; questionId: string; correct: boolean; score: number } }
  | { type: 'UPDATE_KNOWLEDGE_POINT_SCORE'; payload: { id: string; score: number } }
  | { type: 'SET_MEMORY_TIP'; payload: { knowledgePointId: string; tip: string } };

function learningReducer(state: LearningState, action: LearningAction): LearningState {
  switch (action.type) {
    case 'ADD_SUBJECT':
      return { ...state, subjects: [...state.subjects, action.payload] };
    case 'ADD_CHAPTER':
      return { ...state, chapters: [...state.chapters, action.payload] };
    case 'ADD_KNOWLEDGE_POINT':
      return { ...state, knowledgePoints: [...state.knowledgePoints, action.payload as KnowledgePointExtended] };
    case 'DELETE_KNOWLEDGE_POINT':
      return { ...state, knowledgePoints: state.knowledgePoints.filter(kp => kp.id !== action.payload) };
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
            ? { ...kp, proficiency: action.payload.proficiency, lastReviewedAt: now, nextReviewAt: nextReview, reviewCount: kp.reviewCount + 1 }
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
    case 'SET_KNOWLEDGE_DATA':
      return {
        ...state,
        subjects: action.payload.subjects,
        chapters: action.payload.chapters,
        knowledgePoints: action.payload.knowledgePoints as KnowledgePointExtended[],
        questions: action.payload.questions,
      };
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

// 加载持久化数据
function getInitialLearningState(): LearningState {
  const saved = loadState() as Partial<LearningState> | undefined;
  if (saved) {
    // 跨天清理：检查今日复习/新学任务是否过期
    const today = new Date().toISOString().slice(0, 10);
    const savedReviewItems = (saved.todayReviewItems as ReviewItem[]) || [];
    const savedNewItems = (saved.todayNewItems as ReviewItem[]) || [];
    const todayReviewItems = savedReviewItems.filter(item => item.scheduledAt === today);
    const todayNewItems = savedNewItems.filter(item => item.scheduledAt === today);

    return {
      ...initialLearningState,
      subjects: saved.subjects ?? initialLearningState.subjects,
      chapters: saved.chapters ?? initialLearningState.chapters,
      knowledgePoints: saved.knowledgePoints ?? initialLearningState.knowledgePoints,
      questions: saved.questions ?? initialLearningState.questions,
      quizResults: saved.quizResults ?? initialLearningState.quizResults,
      wrongRecords: saved.wrongRecords ?? initialLearningState.wrongRecords,
      todayReviewItems,
      todayNewItems,
      questionExplanations: saved.questionExplanations ?? initialLearningState.questionExplanations,
    };
  }
  return initialLearningState;
}

export function LearningProvider({ children }: { children: ReactNode }) {
  const [learningState, learningDispatch] = useReducer(learningReducer, undefined, getInitialLearningState);
  const isFirstRender = useRef(true);

  // 加载IndexedDB中的知识库数据
  useEffect(() => {
    const loadKnowledgeData = async () => {
      try {
        learningDispatch({ type: 'SET_LOADING', payload: true });
        const hasData = await hasKnowledgeData();
        if (hasData) {
          const data = await getKnowledgeData();
          learningDispatch({ 
            type: 'SET_KNOWLEDGE_DATA', 
            payload: data 
          });
        }
      } catch (error) {
        console.error('Failed to load knowledge data from IndexedDB:', error);
      } finally {
        learningDispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    if (isFirstRender.current) {
      loadKnowledgeData();
      isFirstRender.current = false;
    }
  }, []);

  // 持久化状态到 localStorage
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const currentState = loadState();
    saveState({
      ...currentState,
      subjects: learningState.subjects,
      chapters: learningState.chapters,
      knowledgePoints: learningState.knowledgePoints,
      questions: learningState.questions,
      quizResults: learningState.quizResults,
      wrongRecords: learningState.wrongRecords,
      todayReviewItems: learningState.todayReviewItems,
      todayNewItems: learningState.todayNewItems,
      questionExplanations: learningState.questionExplanations,
    });
  }, [learningState]);

  // 当知识库数据变化时，同步到IndexedDB
  useEffect(() => {
    const saveKnowledgeData = async () => {
      try {
        await storeKnowledgeData({
          subjects: learningState.subjects,
          chapters: learningState.chapters,
          knowledgePoints: learningState.knowledgePoints,
          questions: learningState.questions,
        });
      } catch (error) {
        console.error('Failed to save knowledge data to IndexedDB:', error);
      }
    };

    if (!isFirstRender.current) {
      saveKnowledgeData();
    }
  }, [learningState.subjects, learningState.chapters, learningState.knowledgePoints, learningState.questions]);

  const getLearningStats = useCallback((): LearningStats => {
    const kps = learningState.knowledgePoints;
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
  }, [learningState.knowledgePoints, learningState.quizResults, learningState.subjects]);

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

  const contextValue = useMemo(() => ({
    learningState,
    learningDispatch,
    getLearningStats,
    getTaskCompletionRate,
    undo,
    redo,
    recordHistory,
    _canUndo: learningState._canUndo,
    _canRedo: learningState._canRedo
  }), [learningState, learningDispatch, getLearningStats, getTaskCompletionRate, undo, redo, recordHistory]);

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
