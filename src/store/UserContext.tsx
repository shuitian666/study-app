/**
 * ============================================================================
 * 用户状态管理 - UserContext
 * ============================================================================
 *
 * 包含用户基本信息、页面导航、每日鼓励语等状态
 * ============================================================================
 */

import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from 'react';
import type {
  User, PageName,
} from '@/types';
import { saveState, loadState } from './persistence';

// ---------- State ----------
export interface UserState {
  user: User | null;
  isLoggedIn: boolean;
  currentPage: PageName;
  pageParams: Record<string, string>;
  dailyEncouragement: string | null;
  dailyEncouragementDate: string | null;
  currentBackgroundMap: Record<string, string>;
  currentBackground: string;
  currentPattern: string | null;
}

const initialUserState: UserState = {
  user: null,
  isLoggedIn: false,
  currentPage: 'login',
  pageParams: {},
  dailyEncouragement: null,
  dailyEncouragementDate: null,
  currentBackgroundMap: {},
  currentBackground: 'default',
  currentPattern: null,
};

// ---------- Actions ----------
type UserAction =
  | { type: 'LOGIN'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'NAVIGATE'; payload: { page: PageName; params?: Record<string, string> } }
  | { type: 'UPDATE_USER'; payload: Partial<User> }
  | { type: 'SET_DAILY_ENCOURAGEMENT'; payload: { text: string; date: string } }
  | { type: 'SET_DAILY_GOAL'; payload: number }
  | { type: 'UPDATE_TODAY_GOAL_STATUS'; payload: { questionsCompleted: number; goalMet: boolean } }
  | { type: 'RESET_ALL' };

function userReducer(state: UserState, action: UserAction): UserState {
  switch (action.type) {
    case 'LOGIN':
      // 登录后检查今日是否已答每日一题
      const todayKey = `daily-question-${new Date().toISOString().slice(0, 10)}`;
      const hasAnsweredToday = localStorage.getItem(todayKey) !== null;
      // 今天没答就先进每日一题，答完再进首页
      const targetPage = hasAnsweredToday ? 'home' : 'daily-question';
      return { ...state, user: action.payload, isLoggedIn: true, currentPage: targetPage };
    case 'LOGOUT':
      return { ...state, user: null, isLoggedIn: false, currentPage: 'login' };
    case 'NAVIGATE':
      return { ...state, currentPage: action.payload.page, pageParams: action.payload.params ?? {} };
    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      };
    case 'SET_DAILY_ENCOURAGEMENT':
      return {
        ...state,
        dailyEncouragement: action.payload.text,
        dailyEncouragementDate: action.payload.date,
      };
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
    case 'RESET_ALL':
      return initialUserState;
    default:
      return state;
  }
}

// ---------- Context ----------
interface UserContextType {
  userState: UserState;
  userDispatch: React.Dispatch<UserAction>;
  navigate: (page: PageName, params?: Record<string, string>) => void;
}

const UserContext = createContext<UserContextType | null>(null);

// 加载持久化数据
function getInitialUserState(): UserState {
  const saved = loadState() as Partial<UserState> | undefined;
  if (saved) {
    return {
      ...initialUserState,
      user: saved.user ?? initialUserState.user,
      isLoggedIn: saved.isLoggedIn ?? initialUserState.isLoggedIn,
      currentPage: 'login',
      pageParams: saved.pageParams ?? initialUserState.pageParams,
      dailyEncouragement: saved.dailyEncouragement ?? initialUserState.dailyEncouragement,
      dailyEncouragementDate: saved.dailyEncouragementDate ?? initialUserState.dailyEncouragementDate,
      currentBackgroundMap: saved.currentBackgroundMap ?? initialUserState.currentBackgroundMap,
      currentBackground: saved.currentBackground ?? initialUserState.currentBackground,
      currentPattern: saved.currentPattern ?? initialUserState.currentPattern,
    };
  }
  return initialUserState;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [userState, userDispatch] = useReducer(userReducer, undefined, getInitialUserState);
  const isFirstRender = useRef(true);

  // 持久化状态到 localStorage
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const currentState = loadState();
    saveState({ ...currentState, ...userState });
  }, [userState]);

  const navigate = (page: PageName, params?: Record<string, string>) => {
    userDispatch({ type: 'NAVIGATE', payload: { page, params } });
  };

  return (
    <UserContext.Provider value={{ userState, userDispatch, navigate }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
