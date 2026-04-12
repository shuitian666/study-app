/**
 * ============================================================================
 * 游戏化状态管理 - GameContext
 * ============================================================================
 * 
 * 包含签到、成就、商店、抽奖、团队等游戏化相关状态
 * ============================================================================
 */

import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from 'react';
import type {
  CheckinState, Achievement, ShopItem, AchievementPopup, RankEntry,
  TeamState, TeamMemberProgress, LotteryResult, LotteryPopup,
  DrawBalance, UpPoolConfig, UpPoolResult, LotteryPityState
} from '@/types';
import { MOCK_ACHIEVEMENTS, MOCK_SHOP_ITEMS, MOCK_RANKINGS, MOCK_UP_POOL, STREAK_REWARDS } from '@/data/incentive-mock';
import { saveState, loadState } from './persistence';

// ---------- Checkin reward info ----------
export interface CheckinRewardInfo {
  regularTickets: number;
  upTickets: number;
  streakCoins: number;
  streakLabel?: string;
}

// ---------- Redemption codes ----------
const REDEMPTION_CODES: Record<string, { upDraws: number; regularDraws: number; coins: number }> = {
  '学习使我快乐': { upDraws: 10, regularDraws: 0, coins: 0 },
  '勤奋好学': { upDraws: 5, regularDraws: 0, coins: 0 },
  '全部解锁': { upDraws: 99, regularDraws: 99, coins: 9999 },
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

// ---------- State ----------
export interface GameState {
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
}

const initialGameState: GameState = {
  checkin: { records: [], streak: 0, makeupCards: 2, totalCheckins: 0, lotteryPity: { sinceLastSR: 0, sinceLastSSR: 0 } },
  achievements: MOCK_ACHIEVEMENTS,
  shopItems: MOCK_SHOP_ITEMS,
  rankings: MOCK_RANKINGS,
  achievementPopup: null,
  drawBalance: { regular: 1, up: 0 },
  upPool: MOCK_UP_POOL,
  lastCheckinReward: null,
  team: null,
  lotteryPopup: null,
  redeemedCodes: [],
};

// ---------- Actions ----------
type GameAction =
  | { type: 'CHECKIN'; payload: { date: string; type: 'normal' | 'makeup' | 'team'; teamId?: string } }
  | { type: 'DISMISS_CHECKIN_REWARD' }
  | { type: 'UNLOCK_ACHIEVEMENT'; payload: string }
  | { type: 'DISMISS_ACHIEVEMENT_POPUP' }
  | { type: 'BUY_SHOP_ITEM'; payload: string }
  | { type: 'SET_TEAM'; payload: TeamState | null }
  | { type: 'UPDATE_TEAMMATE_PROGRESS'; payload: TeamMemberProgress }
  | { type: 'DISSOLVE_TEAM' }
  | { type: 'DRAW_REGULAR'; payload: LotteryResult }
  | { type: 'DRAW_UP'; payload: UpPoolResult }
  | { type: 'SHOW_LOTTERY_POPUP'; payload: LotteryPopup }
  | { type: 'DISMISS_LOTTERY_POPUP' }
  | { type: 'REDEEM_CODE'; payload: string };

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
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
      let streakLabel: string | undefined;

      if (!isMakeup) {
        regularTickets = 1;
        if (action.payload.type === 'team') {
          regularTickets += 1;
        }
      }

      const streakReward = STREAK_REWARDS.find(r => r.days === streak);
      if (streakReward) {
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
        lastCheckinReward: { regularTickets, upTickets, streakCoins: 0, streakLabel },
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
      let newMakeupCards = state.checkin.makeupCards;
      
      if (result.reward.type === 'makeup_card') {
        newMakeupCards += result.reward.amount;
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
        drawBalance: { ...state.drawBalance, regular: state.drawBalance.regular - 1 },
        checkin: { ...state.checkin, makeupCards: newMakeupCards, lotteryPity: newPity },
      };
    }

    case 'DRAW_UP': {
      if (state.drawBalance.up <= 0) return state;
      const { item } = action.payload;

      // UP池物品标记为已拥有
      const newUpPool = {
        ...state.upPool,
        items: state.upPool.items.map(i => i.id === item.id ? { ...i, owned: true } : i),
      };

      let newPity: LotteryPityState;
      if (item.rarity === 'SSR') {
        newPity = { sinceLastSSR: 0, sinceLastSR: 0 };
      } else if (item.rarity === 'SR') {
        newPity = { sinceLastSSR: state.checkin.lotteryPity.sinceLastSSR + 1, sinceLastSR: 0 };
      } else {
        newPity = { sinceLastSSR: state.checkin.lotteryPity.sinceLastSSR + 1, sinceLastSR: state.checkin.lotteryPity.sinceLastSR + 1 };
      }

      return {
        ...state,
        drawBalance: { ...state.drawBalance, up: state.drawBalance.up - 1 },
        upPool: newUpPool,
        checkin: { ...state.checkin, lotteryPity: newPity },
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
        achievementPopup: { achievement: { ...ach, unlocked: true, unlockedAt: new Date().toISOString() }, show: true },
      };
    }
    case 'DISMISS_ACHIEVEMENT_POPUP':
      return { ...state, achievementPopup: null };
    case 'BUY_SHOP_ITEM': {
      let item = state.shopItems.find(i => i.id === action.payload);
      if (!item) return state;

      // 检查背包中是否已经拥有该物品（装饰类），已经拥有就不能购买
      if (item.type === 'avatar_frame' || item.type === 'background') {
        // 标记为已拥有
        const newShopItems = state.shopItems.map(i => i.id === action.payload ? { ...i, owned: true } : i);
        return {
          ...state,
          shopItems: newShopItems,
        };
      } else if (item.type === 'makeup_card') {
        // 补签卡可以堆叠，梯度涨价
        let newShopItems = [...state.shopItems];

        // 计算下一次价格梯度：1->30, 2->50, 3->80, 4+->120
        let nextPrice = 30;
        // 更新商店中补签卡的价格
        newShopItems = newShopItems.map(i =>
          i.id === action.payload ? { ...i, price: nextPrice } : i
        );

        return {
          ...state,
          shopItems: newShopItems,
          checkin: { ...state.checkin, makeupCards: state.checkin.makeupCards + 1 },
        };
      } else {
        // 其他物品标记已拥有
        const newShopItems = state.shopItems.map(i => i.id === action.payload ? { ...i, owned: true } : i);
        return {
          ...state,
          shopItems: newShopItems,
        };
      }
    }

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
      };
    }

    default:
      return state;
  }
}

// ---------- Context ----------
interface GameContextType {
  gameState: GameState;
  gameDispatch: React.Dispatch<GameAction>;
  isValidRedeemCode: (code: string) => boolean;
}

const GameContext = createContext<GameContextType | null>(null);

// 加载持久化数据
function getInitialGameState(): GameState {
  const saved = loadState() as Partial<GameState> | undefined;
  if (saved) {
    return {
      ...initialGameState,
      checkin: saved.checkin ?? initialGameState.checkin,
      achievements: saved.achievements ?? initialGameState.achievements,
      shopItems: saved.shopItems ?? initialGameState.shopItems,
      rankings: saved.rankings ?? initialGameState.rankings,
      drawBalance: saved.drawBalance ?? initialGameState.drawBalance,
      upPool: saved.upPool ?? initialGameState.upPool,
      team: saved.team ?? initialGameState.team,
      redeemedCodes: saved.redeemedCodes ?? initialGameState.redeemedCodes,
    };
  }
  return initialGameState;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [gameState, gameDispatch] = useReducer(gameReducer, undefined, getInitialGameState);
  const isFirstRender = useRef(true);

  // 持久化状态到 localStorage
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const currentState = loadState();
    saveState({
      ...currentState,
      checkin: gameState.checkin,
      achievements: gameState.achievements,
      shopItems: gameState.shopItems,
      rankings: gameState.rankings,
      drawBalance: gameState.drawBalance,
      upPool: gameState.upPool,
      team: gameState.team,
      redeemedCodes: gameState.redeemedCodes,
    });
  }, [gameState]);

  return (
    <GameContext.Provider value={{ gameState, gameDispatch, isValidRedeemCode }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
