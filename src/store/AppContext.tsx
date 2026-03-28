/**
 * ============================================================================
 * 全局状态管理 - AppContext
 * ============================================================================
 * 
 * @section ALL
 * @user:兑换码 @user:AI解析 @user:质疑功能 @user:预生成 @user:继续学习 @user:下一阶段
 * 
 * 【架构】React Context + useReducer（类 Redux 单向数据流）
 * ============================================================================
 */

import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from 'react';
import type {
  User, Subject, Chapter, KnowledgePoint, Question,
  QuizResult, WrongRecord, ReviewItem, LearningStats, PageName, ProficiencyLevel,
  CheckinState, Achievement, ShopItem, AchievementPopup, RankEntry,
  TeamState, TeamMemberProgress, LotteryResult, LotteryPopup,
  DrawBalance, UpPoolConfig, UpPoolResult, LotteryPityState,
  ChatMessage, AIChatSession,
  InventoryState, InventoryItem, MailState, MailItem,
} from '@/types';
import { PROFICIENCY_MAP } from '@/types';
import { MOCK_SUBJECTS, MOCK_CHAPTERS, MOCK_KNOWLEDGE_POINTS, MOCK_QUESTIONS } from '@/data/mock';
import { MOCK_ACHIEVEMENTS, MOCK_SHOP_ITEMS, MOCK_RANKINGS, MOCK_UP_POOL, STREAK_REWARDS } from '@/data/incentive-mock';
import { saveState, loadState } from './persistence';

// ---------- Checkin reward info ----------
export interface CheckinRewardInfo {
  regularTickets: number;
  upTickets: number;
  streakCoins: number;
  streakLabel?: string;
}

// ---------- Question Explanation ----------
export interface QuestionExplanation {
  questionId: string;
  explanation: string;
  createdAt: string;
  updatedAt: string;
  isUserModified: boolean;
}

// ---------- State ----------
export interface AppState {
  user: User | null;
  isLoggedIn: boolean;
  currentPage: PageName;
  pageParams: Record<string, string>;
  subjects: Subject[];
  chapters: Chapter[];
  knowledgePoints: KnowledgePoint[];
  questions: Question[];
  quizResults: QuizResult[];
  wrongRecords: WrongRecord[];
  todayReviewItems: ReviewItem[];
  todayNewItems: ReviewItem[];
  // Incentive system
  checkin: CheckinState;
  achievements: Achievement[];
  shopItems: ShopItem[];
  rankings: { studyTime: RankEntry[]; masterCount: RankEntry[] };
  achievementPopup: AchievementPopup | null;
  // Draw ticket system
  drawBalance: DrawBalance;
  upPool: UpPoolConfig;
  lastCheckinReward: CheckinRewardInfo | null;
  // Team & Lottery
  team: TeamState | null;
  lotteryPopup: LotteryPopup | null;
  // Redemption codes
  redeemedCodes: string[];
  // AI features
  aiChat: AIChatSession;
  dailyEncouragement: string | null;
  dailyEncouragementDate: string | null;
  // Question explanations for persistence
  questionExplanations: QuestionExplanation[];
  // Inventory / 背包
  inventory: InventoryState;
  // Mail / 邮件
  mail: MailState;
  // Undo/Redo history (not persisted, in-memory only)
  _history: AppState[];
  _historyIndex: number;
  _canUndo: boolean;
  _canRedo: boolean;
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
  checkin: { records: [], streak: 0, makeupCards: 2, totalCheckins: 0, lotteryPity: { sinceLastSR: 0, sinceLastSSR: 0 } },
  achievements: MOCK_ACHIEVEMENTS,
  shopItems: MOCK_SHOP_ITEMS,
  rankings: MOCK_RANKINGS,
  achievementPopup: null,
  drawBalance: { regular: 0, up: 0 },
  upPool: MOCK_UP_POOL,
  lastCheckinReward: null,
  team: null,
  lotteryPopup: null,
  redeemedCodes: [],
  aiChat: { messages: [], isLoading: false, generatedQuestions: [] },
  dailyEncouragement: null,
  dailyEncouragementDate: null,
  questionExplanations: [],
  // Inventory / 背包
  inventory: { items: [] },
  // Mail / 邮件
  mail: { mails: [], currentVersion: 1 },
  // Undo/Redo (not persisted)
  _history: [],
  _historyIndex: -1,
  _canUndo: false,
  _canRedo: false,
};

// ---------- Redemption codes ----------
const REDEMPTION_CODES: Record<string, { upDraws: number; regularDraws: number; coins: number }> = {
  '学习使我快乐': { upDraws: 10, regularDraws: 0, coins: 0 },
  '勤奋好学': { upDraws: 5, regularDraws: 0, coins: 0 },
};

export function isValidRedeemCode(code: string): boolean {
  return code in REDEMPTION_CODES;
}

// ---------- Helpers ----------
function calculateStreak(records: { date: string }[]): number {
  if (records.length === 0) return 0;
  const sorted = [...records].map(r => r.date).sort().reverse();
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    if (Math.round((prev.getTime() - curr.getTime()) / 86400000) === 1) streak++;
    else break;
  }
  return streak;
}

// ---------- Actions ----------
type Action =
  | { type: 'LOGIN'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'RESET_ALL' }
  | { type: 'NAVIGATE'; payload: { page: PageName; params?: Record<string, string> } }
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
  | { type: 'CHECKIN'; payload: { date: string; type: 'normal' | 'makeup' | 'team'; teamId?: string } }
  | { type: 'DISMISS_CHECKIN_REWARD' }
  | { type: 'UNLOCK_ACHIEVEMENT'; payload: string }
  | { type: 'DISMISS_ACHIEVEMENT_POPUP' }
  | { type: 'BUY_SHOP_ITEM'; payload: string }
  | { type: 'ADD_COINS'; payload: number }
  | { type: 'SET_TEAM'; payload: TeamState | null }
  | { type: 'UPDATE_TEAMMATE_PROGRESS'; payload: TeamMemberProgress }
  | { type: 'DISSOLVE_TEAM' }
  | { type: 'DRAW_REGULAR'; payload: LotteryResult }
  | { type: 'DRAW_UP'; payload: UpPoolResult }
  | { type: 'SHOW_LOTTERY_POPUP'; payload: LotteryPopup }
  | { type: 'DISMISS_LOTTERY_POPUP' }
  | { type: 'REDEEM_CODE'; payload: string }
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
  // Inventory actions
  | { type: 'ADD_INVENTORY_ITEM'; payload: InventoryItem }
  | { type: 'USE_INVENTORY_ITEM'; payload: string }
  | { type: 'REMOVE_INVENTORY_ITEM'; payload: string }
  // Mail actions
  | { type: 'ADD_MAIL'; payload: MailItem }
  | { type: 'SET_MAILS'; payload: MailItem[] }
  | { type: 'MARK_MAIL_READ'; payload: string }
  | { type: 'CLAIM_MAIL_ATTACHMENT'; payload: { mailId: string; attachmentIndex: number } }
  | { type: 'UPDATE_MAIL_VERSION'; payload: number }
  // Undo/Redo actions
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RECORD_HISTORY'; payload: Partial<AppState> };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, user: action.payload, isLoggedIn: true, currentPage: 'home' };
    case 'LOGOUT':
      return { ...state, user: null, isLoggedIn: false, currentPage: 'login', team: null };
    case 'RESET_ALL':
      return { ...initialState };
    case 'NAVIGATE':
      return { ...state, currentPage: action.payload.page, pageParams: action.payload.params ?? {} };
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

    case 'CHECKIN': {
      const exists = state.checkin.records.some(r => r.date === action.payload.date);
      if (exists) {
        console.log('[CHECKIN] 已存在今日签到记录', action.payload.date);
        return state;
      }
      const isMakeup = action.payload.type === 'makeup';
      if (isMakeup && state.checkin.makeupCards <= 0) {
        console.log('[CHECKIN] 补签卡不足');
        return state;
      }

      if (action.payload.type !== 'makeup') {
        // 【修复】与签到页面条件保持一致，只检查复习和每日新学目标
        // 不检查自由学习的额外任务

        // 复习完成检查
        const reviewItems = state.todayReviewItems;
        const reviewCompleted = reviewItems.length === 0 || reviewItems.every(r => r.completed);

        // 每日新学目标完成检查
        const dailyNewGoal = state.user?.dailyGoal ?? 10;
        const newItems = state.todayNewItems;
        const completedNewCount = newItems.filter(r => r.completed).length;
        const newLearnCompleted = completedNewCount >= dailyNewGoal;

        // 做题目标达成检查
        const todayDate = action.payload.date;
        const todayQuestions = state.quizResults
          .filter(r => new Date(r.completedAt).toISOString().slice(0, 10) === todayDate)
          .reduce((sum, r) => sum + r.totalQuestions, 0);
        const dailyGoal = state.user?.dailyGoal ?? 10;
        const goalAchieved = todayQuestions >= dailyGoal;

        console.log('[CHECKIN] 条件检查:', {
          reviewCompleted, newLearnCompleted, goalAchieved,
          completedNewCount, dailyNewGoal,
          todayQuestions, dailyGoal,
          reviewItems: reviewItems.length,
          newItems: newItems.length
        });

        // 满足以下任一条件即可签到：
        // 1. 复习完成 + 每日新学目标完成
        // 2. 做题目标达成
        const canCheckin = (reviewCompleted && newLearnCompleted) || goalAchieved;
        if (!canCheckin) {
          console.log('[CHECKIN] 条件不满足，拒绝签到');
          return state;
        }
        console.log('[CHECKIN] 条件满足，执行签到');
      }

      if (action.payload.type === 'team') {
        if (!state.team || state.team.status !== 'active') return state;
        const allReady = state.team.members.every(m => m.progress.isReady);
        if (!allReady) return state;
      }

      const newRecord = { date: action.payload.date, type: action.payload.type, teamId: action.payload.teamId };
      const newRecords = [...state.checkin.records, newRecord];
      const streak = calculateStreak(newRecords);

      let regularTickets = 0;
      let upTickets = 0;
      let streakCoins = 0;
      let streakLabel: string | undefined;

      if (!isMakeup) {
        regularTickets = 1;
        if (action.payload.type === 'team') {
          regularTickets += 1;
        }
      }

      const streakReward = STREAK_REWARDS.find(r => r.days === streak);
      if (streakReward) {
        streakCoins = streakReward.coins;
        upTickets = streakReward.upDraws;
        streakLabel = streakReward.label;
      }

      return {
        ...state,
        checkin: {
          ...state.checkin,
          records: newRecords,
          streak,
          makeupCards: isMakeup ? state.checkin.makeupCards - 1 : state.checkin.makeupCards,
          totalCheckins: state.checkin.totalCheckins + 1,
        },
        drawBalance: {
          regular: state.drawBalance.regular + regularTickets,
          up: state.drawBalance.up + upTickets,
        },
        user: streakCoins > 0 && state.user
          ? { ...state.user, totalPoints: state.user.totalPoints + streakCoins }
          : state.user,
        lastCheckinReward: { regularTickets, upTickets, streakCoins, streakLabel },
        team: state.team && action.payload.type === 'team'
          ? { ...state.team, todayCheckedIn: true }
          : state.team,
      };
    }

    case 'DISMISS_CHECKIN_REWARD':
      return { ...state, lastCheckinReward: null };

    case 'DRAW_REGULAR': {
      if (state.drawBalance.regular <= 0) return state;
      const result = action.payload;
      let newUser = state.user;
      let newMakeupCards = state.checkin.makeupCards;
      let newInventoryItems = state.inventory.items;
      
      if (result.reward.type === 'coins' && newUser) {
        newUser = { ...newUser, totalPoints: newUser.totalPoints + result.reward.amount };
      } else if (result.reward.type === 'makeup_card') {
        newMakeupCards += result.reward.amount;
        // 将补签卡添加到背包
        const existingMakeup = newInventoryItems.find(i => i.type === 'makeup_card');
        if (existingMakeup) {
          newInventoryItems = newInventoryItems.map(i =>
            i.type === 'makeup_card' ? { ...i, quantity: i.quantity + result.reward.amount } : i
          );
        } else {
          newInventoryItems = [...newInventoryItems, {
            id: `inv-makeup-${Date.now()}`,
            type: 'makeup_card' as const,
            name: '补签卡',
            description: '可在忘记签到时补签',
            icon: '📝',
            rarity: 'R' as const,
            quantity: result.reward.amount,
            obtainedAt: new Date().toISOString(),
            source: 'lottery' as const,
            usable: true,
          }];
        }
      }
      let newPity: LotteryPityState;
      if (result.tier === 'SSR') {
        newPity = { sinceLastSSR: 0, sinceLastSR: 0 };
      } else if (result.tier === 'SR') {
        newPity = { sinceLastSSR: state.checkin.lotteryPity.sinceLastSSR + 1, sinceLastSR: 0 };
      } else {
        newPity = { sinceLastSSR: state.checkin.lotteryPity.sinceLastSSR + 1, sinceLastSR: state.checkin.lotteryPity.sinceLastSR + 1 };
      }
      return {
        ...state,
        user: newUser,
        drawBalance: { ...state.drawBalance, regular: state.drawBalance.regular - 1 },
        checkin: { ...state.checkin, makeupCards: newMakeupCards, lotteryPity: newPity },
        inventory: { items: newInventoryItems },
      };
    }

    case 'DRAW_UP': {
      if (state.drawBalance.up <= 0) return state;
      const { item, isNew } = action.payload;
      // 将物品添加到背包
      const invItem: InventoryItem = {
        id: `inv-up-${item.id}-${Date.now()}`,
        type: item.type as any,
        name: item.name,
        description: item.description,
        icon: item.icon,
        rarity: item.rarity,
        quantity: 1,
        obtainedAt: new Date().toISOString(),
        source: 'lottery',
        usable: false,
      };
      const existingInv = state.inventory.items.find(i => i.name === item.name);
      const newInventoryItems = existingInv
        ? state.inventory.items.map(i =>
            i.name === item.name ? { ...i, quantity: i.quantity + 1 } : i
          )
        : [...state.inventory.items, invItem];
      return {
        ...state,
        drawBalance: { ...state.drawBalance, up: state.drawBalance.up - 1 },
        upPool: isNew ? {
          ...state.upPool,
          items: state.upPool.items.map(i => i.id === item.id ? { ...i, owned: true } : i),
        } : state.upPool,
        inventory: { items: newInventoryItems },
      };
    }

    case 'SHOW_LOTTERY_POPUP':
      return { ...state, lotteryPopup: action.payload };
    case 'DISMISS_LOTTERY_POPUP':
      return { ...state, lotteryPopup: null };

    case 'SET_TEAM':
      return { ...state, team: action.payload };
    case 'UPDATE_TEAMMATE_PROGRESS': {
      if (!state.team) return state;
      return {
        ...state,
        team: {
          ...state.team,
          members: state.team.members.map(m =>
            m.isSimulated ? { ...m, progress: action.payload } : m
          ),
        },
      };
    }
    case 'DISSOLVE_TEAM':
      return { ...state, team: null };

    case 'UNLOCK_ACHIEVEMENT': {
      const ach = state.achievements.find(a => a.id === action.payload);
      if (!ach || ach.unlocked) return state;
      return {
        ...state,
        achievements: state.achievements.map(a =>
          a.id === action.payload ? { ...a, unlocked: true, unlockedAt: new Date().toISOString() } : a
        ),
        user: state.user ? { ...state.user, totalPoints: state.user.totalPoints + ach.reward.coins } : null,
        achievementPopup: { achievement: { ...ach, unlocked: true, unlockedAt: new Date().toISOString() }, show: true },
      };
    }
    case 'DISMISS_ACHIEVEMENT_POPUP':
      return { ...state, achievementPopup: null };
    case 'BUY_SHOP_ITEM': {
      const item = state.shopItems.find(i => i.id === action.payload);
      if (!item || item.owned || !state.user || state.user.totalPoints < item.price) return state;
      return {
        ...state,
        user: { ...state.user, totalPoints: state.user.totalPoints - item.price },
        shopItems: state.shopItems.map(i => i.id === action.payload ? { ...i, owned: true } : i),
        checkin: item.type === 'makeup_card' ? { ...state.checkin, makeupCards: state.checkin.makeupCards + 1 } : state.checkin,
      };
    }
    case 'ADD_COINS':
      return state.user ? { ...state, user: { ...state.user, totalPoints: state.user.totalPoints + action.payload } } : state;

    case 'REDEEM_CODE': {
      const code = action.payload;
      if (state.redeemedCodes.includes(code)) return state;
      const reward = REDEMPTION_CODES[code];
      if (!reward) return state;
      return {
        ...state,
        redeemedCodes: [...state.redeemedCodes, code],
        drawBalance: {
          regular: state.drawBalance.regular + reward.regularDraws,
          up: state.drawBalance.up + reward.upDraws,
        },
        user: reward.coins > 0 && state.user
          ? { ...state.user, totalPoints: state.user.totalPoints + reward.coins }
          : state.user,
      };
    }

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

    // Inventory actions
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

    // Mail actions
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
      return {
        ...state,
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
        // Add claimed items to inventory
        inventory: {
          items: (() => {
            const mail = state.mail.mails.find(m => m.id === mailId);
            if (!mail) return state.inventory.items;
            const attachment = mail.attachments[attachmentIndex];
            if (!attachment || attachment.claimed) return state.inventory.items;
            
            const newItems = [...state.inventory.items];
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
            const existing = newItems.find(i => i.name === attachment.name);
            if (existing) {
              existing.quantity += attachment.quantity;
            } else {
              newItems.push(invItem);
            }
            return newItems;
          })(),
        },
        // Add coins if applicable
        user: (() => {
          const mail = state.mail.mails.find(m => m.id === mailId);
          if (!mail) return state.user;
          const attachment = mail.attachments[attachmentIndex];
          if (!attachment || attachment.claimed || attachment.type !== 'coin') return state.user;
          return state.user ? { ...state.user, totalPoints: state.user.totalPoints + attachment.quantity } : null;
        })(),
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

    // Undo/Redo actions
    case 'RECORD_HISTORY': {
      // Only record certain actions for undo (not navigation, not undo/redo)
      const newHistory = state._history.slice(0, state._historyIndex + 1);
      newHistory.push({
        subjects: state.subjects,
        chapters: state.chapters,
        knowledgePoints: state.knowledgePoints,
        questions: state.questions,
        inventory: state.inventory,
      } as AppState);
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
      return {
        ...state,
        ...prevState,
        _history: state._history,
        _historyIndex: state._historyIndex - 1,
        _canUndo: state._historyIndex > 1,
        _canRedo: true,
      };
    }
    case 'REDO': {
      if (state._historyIndex >= state._history.length - 1) return state;
      const nextState = state._history[state._historyIndex + 1];
      return {
        ...state,
        ...nextState,
        _history: state._history,
        _historyIndex: state._historyIndex + 1,
        _canUndo: true,
        _canRedo: state._historyIndex < state._history.length - 2,
      };
    }

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
  // Undo/Redo
  undo: () => void;
  redo: () => void;
  recordHistory: () => void;
  _canUndo: boolean;
  _canRedo: boolean;
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

  // Undo/Redo functions
  const undo = () => {
    if (state._canUndo) {
      dispatch({ type: 'UNDO' });
    }
  };

  const redo = () => {
    if (state._canRedo) {
      dispatch({ type: 'REDO' });
    }
  };

  const recordHistory = () => {
    dispatch({ type: 'RECORD_HISTORY', payload: {} });
  };

  // Initialize history on login
  useEffect(() => {
    if (state.isLoggedIn && state._history.length === 0) {
      dispatch({ type: 'RECORD_HISTORY', payload: {} });
    }
  }, [state.isLoggedIn]);

  return (
    <AppContext.Provider value={{ state, dispatch, getLearningStats, getTaskCompletionRate, navigate, undo, redo, recordHistory, _canUndo: state._canUndo, _canRedo: state._canRedo }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
