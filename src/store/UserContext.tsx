/**
 * ============================================================================
 * 用户状态管理 - UserContext
 * ============================================================================
 * 
 * 包含用户基本信息、页面导航、每日鼓励语、背包和邮件等状态
 * ============================================================================
 */

import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from 'react';
import type {
  User, PageName, InventoryState, InventoryItem, MailState, MailItem,
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
  inventory: InventoryState;
  mail: MailState;
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
  inventory: { items: [] },
  mail: { mails: [], currentVersion: 1 },
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
  | { type: 'ADD_INVENTORY_ITEM'; payload: InventoryItem }
  | { type: 'USE_INVENTORY_ITEM'; payload: string }
  | { type: 'REMOVE_INVENTORY_ITEM'; payload: string }
  | { type: 'ADD_MAIL'; payload: MailItem }
  | { type: 'SET_MAILS'; payload: MailItem[] }
  | { type: 'MARK_MAIL_READ'; payload: string }
  | { type: 'CLAIM_MAIL_ATTACHMENT'; payload: { mailId: string; attachmentIndex: number } }
  | { type: 'UPDATE_MAIL_VERSION'; payload: number }
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
    case 'ADD_INVENTORY_ITEM': {
      const existing = state.inventory.items.find(i => i.id === action.payload.id);
      if (existing) {
        return {
          ...state,
          inventory: {
            items: state.inventory.items.map(i =>
              i.id === action.payload.id ? { ...i, quantity: i.quantity + action.payload.quantity } : i
            ),
          },
        };
      }
      return {
        ...state,
        inventory: {
          items: [...state.inventory.items, action.payload],
        },
      };
    }
    case 'USE_INVENTORY_ITEM': {
      const item = state.inventory.items.find(i => i.id === action.payload);
      if (!item || item.quantity <= 0 || !item.usable) return state;
      return {
        ...state,
        inventory: {
          items: state.inventory.items.map(i =>
            i.id === action.payload ? { ...i, quantity: i.quantity - 1 } : i
          ).filter(i => i.quantity > 0),
        },
      };
    }
    case 'REMOVE_INVENTORY_ITEM': {
      return {
        ...state,
        inventory: {
          items: state.inventory.items.filter(i => i.id !== action.payload),
        },
      };
    }
    case 'ADD_MAIL': {
      const exists = state.mail.mails.find(m => m.id === action.payload.id);
      if (exists) return state;
      return {
        ...state,
        mail: {
          ...state.mail,
          mails: [action.payload, ...state.mail.mails],
        },
      };
    }
    case 'SET_MAILS':
      return {
        ...state,
        mail: {
          ...state.mail,
          mails: action.payload,
        },
      };
    case 'MARK_MAIL_READ':
      return {
        ...state,
        mail: {
          ...state.mail,
          mails: state.mail.mails.map(m =>
            m.id === action.payload ? { ...m, read: true } : m
          ),
        },
      };
    case 'CLAIM_MAIL_ATTACHMENT': {
      const { mailId, attachmentIndex } = action.payload;
      let newUser = state.user;
      let newInventoryItems = [...state.inventory.items];

      const mail = state.mail.mails.find(m => m.id === mailId);
      if (mail && state.user) {
        const attachment = mail.attachments[attachmentIndex];
        if (attachment && !attachment.claimed) {
          if (attachment.type === 'coin') {
            newUser = { ...state.user, totalPoints: state.user.totalPoints + attachment.quantity };
          } else if (attachment.type === 'makeup_card') {
            const existing = newInventoryItems.find(i => i.type === 'makeup_card');
            if (existing) {
              newInventoryItems = newInventoryItems.map(i =>
                i.type === 'makeup_card' ? { ...i, quantity: i.quantity + attachment.quantity } : i
              );
            } else {
              newInventoryItems.push({
                id: `inv-${Date.now()}-${attachmentIndex}`,
                type: attachment.type as any,
                name: attachment.name,
                description: `来自邮件: ${mail.title}`,
                icon: '🎁',
                rarity: 'R',
                quantity: attachment.quantity,
                obtainedAt: new Date().toISOString(),
                source: 'mail',
                usable: true,
              });
            }
          } else if (attachment.type === 'avatar_frame' || attachment.type === 'background') {
            const existing = newInventoryItems.find(i => i.name === attachment.name);
            if (existing) {
              let compensation = 10;
              const rarity = (attachment as any).rarity;
              if (rarity) {
                switch (rarity) {
                  case 'N': compensation = 10; break;
                  case 'R': compensation = 30; break;
                  case 'SR': compensation = 60; break;
                  case 'SSR': compensation = 150; break;
                }
              }
              newUser = { ...state.user, totalPoints: state.user.totalPoints + compensation };
              console.log(`[CLAIM_MAIL] 重复获得 ${attachment.name}，补偿 ${compensation} 星币`);
            } else {
              newInventoryItems.push({
                id: `inv-${Date.now()}-${attachmentIndex}`,
                type: attachment.type as any,
                name: attachment.name,
                description: `来自邮件: ${mail.title}`,
                icon: attachment.icon || '🎁',
                rarity: (attachment as any).rarity || 'R',
                quantity: 1,
                obtainedAt: new Date().toISOString(),
                source: 'mail',
                usable: false,
              });
            }
          } else {
            const invItem: InventoryItem = {
              id: `inv-${Date.now()}-${attachmentIndex}`,
              type: attachment.type as any,
              name: attachment.name,
              description: `来自邮件: ${mail.title}`,
              icon: '🎁',
              rarity: 'R',
              quantity: attachment.quantity,
              obtainedAt: new Date().toISOString(),
              source: 'mail',
              usable: true,
            };
            const existing = newInventoryItems.find(i => i.name === attachment.name);
            if (existing) {
              existing.quantity += attachment.quantity;
            } else {
              newInventoryItems.push(invItem);
            }
          }
        }
      }

      return {
        ...state,
        user: newUser,
        mail: {
          ...state.mail,
          mails: state.mail.mails.map(m => {
            if (m.id !== mailId) return m;
            const newAttachments = m.attachments.map((a, idx) =>
              idx === attachmentIndex ? { ...a, claimed: true } : a
            );
            return { ...m, attachments: newAttachments, claimed: newAttachments.every(a => a.claimed) };
          }),
        },
        inventory: { items: newInventoryItems },
      };
    }
    case 'UPDATE_MAIL_VERSION':
      return {
        ...state,
        mail: {
          ...state.mail,
          currentVersion: action.payload,
        },
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
      inventory: saved.inventory ?? initialUserState.inventory,
      mail: saved.mail ?? initialUserState.mail,
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
