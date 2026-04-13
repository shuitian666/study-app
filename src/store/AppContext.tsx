/**
 * ============================================================================
 * 全局状态管理 - AppContext
 * ============================================================================
 *
 * @section ALL
 *
 * 【架构】React Context + useReducer（类 Redux 单向数据流）
 *
 * 注意：游戏化相关状态已迁移至 GameContext
 * ============================================================================
 */

import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from 'react';
import type {
  User, Subject, Chapter, KnowledgePoint, Question,
  QuizResult, WrongRecord, ReviewItem, LearningStats, PageName, ProficiencyLevel,
  ChatMessage, AIChatSession,
} from '@/types';
import { PROFICIENCY_MAP } from '@/types';
import { MOCK_SUBJECTS, MOCK_CHAPTERS, MOCK_KNOWLEDGE_POINTS, MOCK_QUESTIONS } from '@/data/mock';
import { saveState, loadState } from './persistence';

// ---------- State ----------
export interface AppState {
  // User
  user: User | null;
  isLoggedIn: boolean;
  currentPage: PageName;
  pageParams: Record<string, string>;
  // Learning data
  subjects: Subject[];
  chapters: Chapter[];
  knowledgePoints: KnowledgePoint[];
  questions: Question[];
  quizResults: QuizResult[];
  wrongRecords: WrongRecord[];
  todayReviewItems: ReviewItem[];
  todayNewItems: ReviewItem[];
  // AI features
  aiChat: AIChatSession;
  dailyEncouragement: string | null;
  dailyEncouragementDate: string | null;
  // Question explanations for persistence
  questionExplanations: QuestionExplanation[];
}

// ---------- Question Explanation ----------
export interface QuestionExplanation {
  questionId: string;
  explanation: string;
  createdAt: string;
  updatedAt: string;
  isUserModified: boolean;
}

const initialState: AppState = {
  user: null,
  isLoggedIn: false,
  currentPage: 'login',
  pageParams: {},
  subjects: MOCK_SUBJECTS,
  chapters: MOCK_CHAPTERS,
  knowledgePoints: MOCK_KNOWLEDGE_POINTS,
  questions: MOCK_QUESTIONS,
  quizResults: [],
  wrongRecords: [],
  todayReviewItems: [],
  todayNewItems: [],
  aiChat: { messages: [], isLoading: false, generatedQuestions: [] },
  dailyEncouragement: null,
  dailyEncouragementDate: null,
  questionExplanations: [],
};

// ---------- Actions ----------
export type Action =
  | { type: 'LOGIN'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'RESET_ALL' }
  | { type: 'NAVIGATE'; payload: { page: PageName; params?: Record<string, string> } }
  | { type: 'UPDATE_USER'; payload: Partial<User> }
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
  | { type: 'INCREMENT_LEARNING_DAYS' }
  | { type: 'AI_SEND_MESSAGE'; payload: ChatMessage }
  | { type: 'AI_RECEIVE_MESSAGE'; payload: ChatMessage }
  | { type: 'AI_SET_LOADING'; payload: boolean }
  | { type: 'AI_ADD_GENERATED_QUESTION'; payload: Question }
  | { type: 'AI_CLEAR_CHAT' }
  | { type: 'AI_UPDATE_STREAMING_MESSAGE'; payload: { id: string; content: string } }
  | { type: 'SET_DAILY_ENCOURAGEMENT'; payload: { text: string; date: string } }
  | { type: 'SAVE_QUESTION_EXPLANATION'; payload: QuestionExplanation }
  | { type: 'UPDATE_QUESTION_EXPLANATION'; payload: { questionId: string; explanation: string } }
  | { type: 'DELETE_QUESTION_EXPLANATION'; payload: string }
  | { type: 'SET_DAILY_GOAL'; payload: number }
  | { type: 'UPDATE_TODAY_GOAL_STATUS'; payload: { questionsCompleted: number; goalMet: boolean } }
  // Sync actions from LearningContext
  | { type: 'SYNC_QUIZ_RESULTS'; payload: QuizResult[] }
  | { type: 'SYNC_WRONG_RECORDS'; payload: WrongRecord[] }
  | { type: 'SYNC_REVIEW_ITEMS'; payload: { review: ReviewItem[]; newItems: ReviewItem[] } };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, user: action.payload, isLoggedIn: true, currentPage: 'home' };
    case 'LOGOUT':
      return { ...state, user: null, isLoggedIn: false, currentPage: 'login' };
    case 'RESET_ALL':
      return { ...initialState };
    case 'NAVIGATE':
      return { ...state, currentPage: action.payload.page, pageParams: action.payload.params ?? {} };
    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      };
    case 'ADD_SUBJECT':
      return { ...state, subjects: [...state.subjects, action.payload] };
    case 'ADD_CHAPTER':
      return { ...state, chapters: [...state.chapters, action.payload] };
    case 'ADD_KNOWLEDGE_POINT':
      return { ...state, knowledgePoints: [...state.knowledgePoints, action.payload] };
    case 'DELETE_KNOWLEDGE_POINT':
      return { ...state, knowledgePoints: state.knowledgePoints.filter(kp => kp.id !== action.payload) };
    case 'UPDATE_KNOWLEDGE_POINT':
      return {
        ...state,
        knowledgePoints: state.knowledgePoints.map(kp =>
          kp.id === action.payload.id ? { ...kp, ...action.payload } : kp
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
    case 'INCREMENT_LEARNING_DAYS':
      return state.user
        ? { ...state, user: { ...state.user, learningDays: state.user.learningDays + 1 } }
        : state;

    case 'AI_SEND_MESSAGE':
      return {
        ...state,
        aiChat: {
          ...state.aiChat,
          messages: [...state.aiChat.messages, action.payload],
          isLoading: true,
        },
      };
    case 'AI_RECEIVE_MESSAGE':
      return {
        ...state,
        aiChat: {
          ...state.aiChat,
          messages: [...state.aiChat.messages, action.payload],
          isLoading: false,
        },
      };
    case 'AI_SET_LOADING':
      return {
        ...state,
        aiChat: { ...state.aiChat, isLoading: action.payload },
      };
    case 'AI_ADD_GENERATED_QUESTION':
      return {
        ...state,
        questions: [...state.questions, action.payload],
        aiChat: {
          ...state.aiChat,
          generatedQuestions: [...state.aiChat.generatedQuestions, action.payload.id],
        },
      };
    case 'AI_CLEAR_CHAT':
      return {
        ...state,
        aiChat: { messages: [], isLoading: false, generatedQuestions: [] },
      };
    case 'AI_UPDATE_STREAMING_MESSAGE':
      return {
        ...state,
        aiChat: {
          ...state.aiChat,
          messages: state.aiChat.messages.map(m =>
            m.id === action.payload.id ? { ...m, content: action.payload.content } : m
          ),
        },
      };
    case 'SET_DAILY_ENCOURAGEMENT':
      return {
        ...state,
        dailyEncouragement: action.payload.text,
        dailyEncouragementDate: action.payload.date,
      };

    // Question explanation actions
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

    // Daily goal actions
    case 'SET_DAILY_GOAL':
      return {
        ...state,
        user: state.user ? { ...state.user, dailyGoal: action.payload } : state.user,
      };
    case 'UPDATE_TODAY_GOAL_STATUS':
      return {
        ...state,
        user: state.user
          ? {
              ...state.user,
              todayQuestions: action.payload.questionsCompleted,
              goalAchievedToday: action.payload.goalMet
            }
          : state.user,
      };

    // Undo/Redo actions
    // Sync actions from LearningContext
    case 'SYNC_QUIZ_RESULTS':
      return { ...state, quizResults: action.payload };
    case 'SYNC_WRONG_RECORDS':
      return { ...state, wrongRecords: action.payload };
    case 'SYNC_REVIEW_ITEMS':
      return {
        ...state,
        todayReviewItems: action.payload.review,
        todayNewItems: action.payload.newItems
      };

    default:
      return state;
  }
}

// ---------- Context ----------
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  getLearningStats: () => LearningStats;
  getTaskCompletionRate: () => { done: number; total: number; rate: number };
  navigate: (page: PageName, params?: Record<string, string>) => void;
}

const AppContext = createContext<AppContextType | null>(null);

// 加载持久化数据
function getInitialState(): AppState {
  const saved = loadState();
  if (saved) {
    // 【修复】跨天清理：检查今日复习/新学任务是否过期
    const today = new Date().toISOString().slice(0, 10);
    const savedReviewItems = (saved.todayReviewItems as ReviewItem[]) || [];
    const savedNewItems = (saved.todayNewItems as ReviewItem[]) || [];
    const todayReviewItems = savedReviewItems.filter(item => item.scheduledAt === today);
    const todayNewItems = savedNewItems.filter(item => item.scheduledAt === today);

    return {
      ...initialState,
      ...saved,
      todayReviewItems,
      todayNewItems,
      aiChat: initialState.aiChat,
      dailyEncouragement: initialState.dailyEncouragement,
      dailyEncouragementDate: initialState.dailyEncouragementDate,
      currentPage: 'login',
      isLoggedIn: false,
    };
  }
  return initialState;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);
  const isFirstRender = useRef(true);

  // 注册 dispatch 到同步注册表，让 LearningContext 可以同步状态
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
    }
    // 注册 dispatch 用于跨 Context 同步
    import('./syncRegistry').then(({ registerAppDispatch }) => {
      registerAppDispatch(dispatch);
    });
  }, [dispatch]);

  // 持久化状态到 localStorage
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveState(state as unknown as Record<string, unknown>);
  }, [state]);

  const getLearningStats = (): LearningStats => {
    const kps = state.knowledgePoints;
    const masteredCount = kps.filter(k => k.proficiency === 'master').length;
    const normalCount = kps.filter(k => k.proficiency === 'normal').length;
    const rustyCount = kps.filter(k => k.proficiency === 'rusty').length;
    const noneCount = kps.filter(k => k.proficiency === 'none').length;

    const totalQuizzes = state.quizResults.length;
    const averageScore = totalQuizzes > 0
      ? Math.round(state.quizResults.reduce((sum, q) => sum + q.score, 0) / totalQuizzes)
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
      .map(([id]) => state.subjects.find(s => s.id === id)?.name ?? id);

    return {
      totalKnowledgePoints: kps.length,
      masteredCount,
      normalCount,
      rustyCount,
      noneCount,
      totalQuizzes,
      averageScore,
      streakDays: state.user?.learningDays ?? 0,
      weakSubjects,
    };
  };

  const getTaskCompletionRate = () => {
    const allTasks = [...state.todayReviewItems, ...state.todayNewItems];
    const total = allTasks.length;
    const done = allTasks.filter(t => t.completed).length;
    const rate = total === 0 ? 1 : done / total;
    return { done, total, rate };
  };

  const navigate = (page: PageName, params?: Record<string, string>) => {
    dispatch({ type: 'NAVIGATE', payload: { page, params } });
  };

  return (
    <AppContext.Provider value={{ state, dispatch, getLearningStats, getTaskCompletionRate, navigate }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
