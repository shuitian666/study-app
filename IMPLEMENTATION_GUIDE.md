# TRAE 架构改进实施指南
> 手把手带你重构 | 包含完整代码示例

---

## 📌 快速开始

### 第0步：项目准备
```bash
# 1. 创建feature分支
git checkout -b refactor/architecture-improvement

# 2. 创建测试覆盖baseline（重要！）
npm run test:coverage

# 3. 备份当前状态
git tag backup/before-refactor
```

---

## 🔄 第1阶段：分离GamificationContext

### 1.1 创建GamificationContext框架
**文件创建：** `src/store/GamificationContext.tsx`

```typescript
import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import type { 
  Achievement, CheckinState, ShopItem, Ranking, 
  DrawBalance, UpPoolConfig, LotteryPopup, AchievementPopup,
  TeamState, User
} from '@/types';
import { MOCK_ACHIEVEMENTS, MOCK_SHOP_ITEMS, MOCK_RANKINGS, MOCK_UP_POOL } from '@/data/incentive-mock';

// ============= STATE =============
export interface GamificationState {
  checkin: CheckinState;
  achievements: Achievement[];
  shopItems: ShopItem[];
  rankings: Ranking;
  drawBalance: DrawBalance;
  upPool: UpPoolConfig;
  lotteryPopup: LotteryPopup | null;
  achievementPopup: AchievementPopup | null;
  team: TeamState | null;
  // 最后一次签到的奖励信息，用于显示弹窗
  lastCheckinReward: {
    regularTickets: number;
    upTickets: number;
    streakCoins: number;
    streakLabel?: string;
  } | null;
}

const initialState: GamificationState = {
  checkin: { records: [], streak: 0, makeupCards: 2, totalCheckins: 0, lotteryPity: { sinceLastSR: 0, sinceLastSSR: 0 } },
  achievements: MOCK_ACHIEVEMENTS,
  shopItems: MOCK_SHOP_ITEMS,
  rankings: MOCK_RANKINGS,
  drawBalance: { regular: 0, up: 0 },
  upPool: MOCK_UP_POOL,
  lotteryPopup: null,
  achievementPopup: null,
  team: null,
  lastCheckinReward: null,
};

// ============= ACTIONS =============
export type GamificationAction =
  | { type: 'CHECKIN'; payload: { date: string; type: 'normal' | 'makeup' | 'team'; teamId?: string } }
  | { type: 'DISMISS_CHECKIN_REWARD' }
  | { type: 'UNLOCK_ACHIEVEMENT'; payload: string }
  | { type: 'DISMISS_ACHIEVEMENT_POPUP' }
  | { type: 'BUY_SHOP_ITEM'; payload: string }
  | { type: 'DRAW_REGULAR'; payload: LotteryResult }
  | { type: 'DRAW_UP'; payload: UpPoolResult }
  | { type: 'SHOW_LOTTERY_POPUP'; payload: LotteryPopup }
  | { type: 'DISMISS_LOTTERY_POPUP' }
  | { type: 'SET_TEAM'; payload: TeamState | null }
  | { type: 'UPDATE_TEAMMATE_PROGRESS'; payload: TeamMemberProgress }
  | { type: 'DISSOLVE_TEAM' }
  | { type: 'RESET_ALL' };

// ============= REDUCER =============
function gamificationReducer(state: GamificationState, action: GamificationAction): GamificationState {
  switch (action.type) {
    case 'CHECKIN': {
      // 【NOTE】规则检查暂时保留，后续分离到规则引擎
      // 这里只处理状态更新
      
      const exists = state.checkin.records.some(r => r.date === action.payload.date);
      if (exists) return state;

      const newRecord = { date: action.payload.date, type: action.payload.type, teamId: action.payload.teamId };
      const newRecords = [...state.checkin.records, newRecord];
      const streak = calculateStreak(newRecords);

      return {
        ...state,
        checkin: {
          ...state.checkin,
          records: newRecords,
          streak,
        },
      };
    }

    case 'DISMISS_CHECKIN_REWARD':
      return { ...state, lastCheckinReward: null };

    case 'UNLOCK_ACHIEVEMENT': {
      const ach = state.achievements.find(a => a.id === action.payload);
      if (!ach || ach.unlocked) return state;
      return {
        ...state,
        achievements: state.achievements.map(a =>
          a.id === action.payload ? { ...a, unlocked: true, unlockedAt: new Date().toISOString() } : a
        ),
        achievementPopup: { 
          achievement: { ...ach, unlocked: true, unlockedAt: new Date().toISOString() }, 
          show: true 
        },
      };
    }

    case 'DISMISS_ACHIEVEMENT_POPUP':
      return { ...state, achievementPopup: null };

    case 'DRAW_REGULAR': {
      if (state.drawBalance.regular <= 0) return state;
      // 【TODO】抽奖逻辑
      return { ...state, drawBalance: { ...state.drawBalance, regular: state.drawBalance.regular - 1 } };
    }

    case 'DRAW_UP': {
      if (state.drawBalance.up <= 0) return state;
      // 【TODO】UP池抽奖逻辑
      return { ...state, drawBalance: { ...state.drawBalance, up: state.drawBalance.up - 1 } };
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

    case 'BUY_SHOP_ITEM': {
      // 【TODO】购买逻辑，需要访问user数据
      return state;
    }

    case 'RESET_ALL':
      return { ...initialState };

    default:
      return state;
  }
}

// ============= CONTEXT + HOOK =============
interface GamificationContextType {
  state: GamificationState;
  dispatch: React.Dispatch<GamificationAction>;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

export function GamificationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gamificationReducer, initialState);

  return (
    <GamificationContext.Provider value={{ state, dispatch }}>
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamification() {
  const context = useContext(GamificationContext);
  if (context === undefined) {
    throw new Error('useGamification must be used within GamificationProvider');
  }
  return context;
}

// ============= HELPERS =============
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
```

### 1.2 从AppContext中删除游戏化状态
**修改文件：** `src/store/AppContext.tsx`

```typescript
// ❌ 删除这些
export interface AppState {
  // 删除以下字段（已移到GamificationContext）
  // checkin: CheckinState;
  // achievements: Achievement[];
  // shopItems: ShopItem[];
  // rankings: Ranking;
  // drawBalance: DrawBalance;
  // upPool: UpPoolConfig;
  // team: TeamState | null;
  // lotteryPopup: LotteryPopup | null;
  // achievementPopup: AchievementPopup | null;
  // lastCheckinReward: CheckinRewardInfo | null;

  // ✅ 保留这些（最小化AppContext）
  user: User | null;
  isLoggedIn: boolean;
  currentPage: PageName;
  pageParams: Record<string, string>;
  
  // 其他页面级别的UI状态...
}

// ❌ 删除相关的reducer case
function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    // 删除所有CHECKIN, UNLOCK_ACHIEVEMENT, DRAW_* 等case
    
    case 'LOGIN':
      return { ...state, user: action.payload, isLoggedIn: true, currentPage: 'home' };
    // ... 保留其他必要的case
  }
}
```

### 1.3 更新App.tsx以支持多个Provider
**修改文件：** `src/App.tsx`

```typescript
import { UserProvider } from '@/store/UserContext';
import { LearningProvider } from '@/store/LearningContext';
import { GamificationProvider } from '@/store/GamificationContext'; // NEW
import { ThemeProvider } from '@/store/ThemeContext';
import AppContent from './AppContent';

export default function App() {
  return (
    <ThemeProvider>
      <UserProvider>
        <LearningProvider>
          <GamificationProvider> {/* NEW */}
            <AppContent />
          </GamificationProvider>
        </LearningProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
```

### 1.4 更新所有使用游戏化状态的组件
**示例修改：** `src/features/gamification/checkin/index.tsx`

```typescript
// ❌ 旧写法
import { useApp } from '@/store/AppContext';
export default function CheckinPage() {
  const { appState, appDispatch } = useApp();
  const { checkin, achievements } = appState;
  
  const handleCheckin = () => {
    appDispatch({ type: 'CHECKIN', payload: {...} });
  };
}

// ✅ 新写法
import { useGamification } from '@/store/GamificationContext';
import { useLearning } from '@/store/LearningContext';

export default function CheckinPage() {
  const { state: gamState, dispatch: gamDispatch } = useGamification();
  const { learningState } = useLearning(); // 获取学习数据用于条件判断
  
  const { checkin, achievements } = gamState;
  
  const handleCheckin = () => {
    gamDispatch({ type: 'CHECKIN', payload: {...} });
  };
}
```

### 1.5 迁移清单
```
[ ] 创建 GamificationContext.tsx
[ ] 从 AppContext 删除游戏化状态
[ ] 更新 App.tsx 添加 GamificationProvider
[ ] 查找所有使用 appState.checkin/achievements/etc 的地方
    grep -r "appState\." src/ | grep -E "(checkin|achievement|lottery|team|drawBalance|upPool)"
[ ] 逐个更新引入和使用
[ ] 运行测试确保没有报错
[ ] 检查是否有跨Context同步逻辑需要处理
```

---

## 🛠️ 第2阶段：迁移到React Router v6

### 2.1 安装依赖
```bash
npm install react-router-dom
npm uninstall react-router  # 如果有冲突
```

### 2.2 定义路由结构
**文件创建：** `src/router/types.ts`

```typescript
// 路由参数定义
export interface RouteParams {
  'learning/quiz': { knowledgePointId: string };
  'learning/review': {};
  'gamification/checkin': {};
  'profile': { userId?: string };
  // ... 其他路由
}

// 路由路径类型安全
export type RoutePath = keyof RouteParams;
```

**文件创建：** `src/router/routes.tsx`

```typescript
import { RouteObject } from 'react-router-dom';
import React from 'react';

// 懒加载所有页面组件
const LoginPage = React.lazy(() => import('@/pages/Login'));
const HomePage = React.lazy(() => import('@/pages/Home'));
const ProfilePage = React.lazy(() => import('@/pages/Profile'));
const CheckinPage = React.lazy(() => import('@/features/gamification/checkin'));
const FlashcardLearningPage = React.lazy(() => import('@/pages/FlashcardLearning'));
const QuizSessionPage = React.lazy(() => import('@/pages/Quiz/QuizSession'));
// ... 导入所有页面

export const routes: RouteObject[] = [
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <Layout />, // 布局包裹，包含TabBar等
    children: [
      {
        index: true, // 默认路由 → /
        element: <HomePage />,
      },
      {
        path: 'home',
        element: <HomePage />,
      },
      {
        path: 'profile',
        element: <ProfilePage />,
      },
      {
        path: 'learning/flashcard',
        element: <FlashcardLearningPage />,
      },
      {
        path: 'learning/quiz/:knowledgePointId',
        element: <QuizSessionPage />,
      },
      {
        path: 'gamification/checkin',
        element: <CheckinPage />,
      },
      // ... 其他路由
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
];
```

### 2.3 创建Layout组件
**文件创建：** `src/components/layout/AppLayout.tsx`

```typescript
import { Outlet, useLocation } from 'react-router-dom';
import TabBar from './TabBar';
import AchievementPopup from '@/components/ui/AchievementPopup';
import LotteryDrawModal from '@/components/ui/LotteryDrawModal';

const HIDDEN_PAGES = new Set(['/login', '/auth']);

export default function AppLayout() {
  const location = useLocation();
  const showTabBar = !HIDDEN_PAGES.has(location.pathname);

  return (
    <div className="app-container">
      <div className="main-content">
        <Outlet /> {/* 子路由在这里渲染 */}
      </div>
      {showTabBar && <TabBar />}
      <AchievementPopup />
      <LotteryDrawModal />
    </div>
  );
}
```

### 2.4 更新App.tsx
**修改文件：** `src/App.tsx`

```typescript
import { BrowserRouter, useRoutes } from 'react-router-dom';
import { routes } from '@/router/routes';
import { UserProvider } from '@/store/UserContext';
import { LearningProvider } from '@/store/LearningContext';
import { GamificationProvider } from '@/store/GamificationContext';
import { ThemeProvider } from '@/store/ThemeContext';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

function AppContent() {
  return (
    <Suspense 
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      }
    >
      {useRoutes(routes)}
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <UserProvider>
          <LearningProvider>
            <GamificationProvider>
              <AppContent />
            </GamificationProvider>
          </LearningProvider>
        </UserProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
```

### 2.5 创建导航工具函数（保持API兼容性）
**文件创建：** `src/hooks/useAppNavigate.ts`

```typescript
import { useNavigate, useLocation } from 'react-router-dom';
import { useCallback } from 'react';

export function useAppNavigate() {
  const navigate = useNavigate();
  const location = useLocation();

  const navigateTo = useCallback((path: string, params?: Record<string, string>) => {
    let finalPath = path;
    
    // 支持旧的 page 导航方式转换为新的路由
    const pathMap: Record<string, string> = {
      'home': '/',
      'profile': '/profile',
      'flashcard': '/learning/flashcard',
      'quiz': '/learning/quiz',
      'checkin': '/gamification/checkin',
      // ... 其他映射
    };

    if (pathMap[path]) {
      finalPath = pathMap[path];
    }

    // 处理参数
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      finalPath = `${finalPath}?${queryString}`;
    }

    navigate(finalPath);
  }, [navigate]);

  return navigateTo;
}
```

### 2.6 更新TabBar组件
**修改文件：** `src/components/layout/TabBar.tsx`

```typescript
import { useLocation, Link } from 'react-router-dom';

export default function TabBar() {
  const location = useLocation();

  const tabs = [
    { path: '/', label: '首页', icon: 'home' },
    { path: '/learning/flashcard', label: '学习', icon: 'book' },
    { path: '/gamification/checkin', label: '签到', icon: 'calendar' },
    { path: '/profile', label: '我的', icon: 'user' },
  ];

  return (
    <nav className="tab-bar">
      {tabs.map(tab => (
        <Link
          key={tab.path}
          to={tab.path}
          className={`tab-item ${location.pathname === tab.path ? 'active' : ''}`}
        >
          <Icon name={tab.icon} />
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
```

### 2.7 迁移所有页面中的navigate调用
**查找所有待修改的地方：**

```bash
# 查找所有使用 useUser 的 navigate 的地方
grep -r "const { navigate }" src/pages --include="*.tsx" | head -20

# 查找所有 navigate() 调用
grep -r "navigate(" src/pages --include="*.tsx" | head -20
```

**示例修改 - FlashcardLearning页面：**

```typescript
// ❌ 旧方式
import { useUser } from '@/store/UserContext';

export default function FlashcardLearningPage() {
  const { navigate } = useUser();
  
  const handleBack = () => navigate('home');
  const handleNext = () => navigate('quiz', { knowledgePointId: 'kp-123' });
}

// ✅ 新方式
import { useNavigate } from 'react-router-dom';

export default function FlashcardLearningPage() {
  const navigate = useNavigate();
  
  const handleBack = () => navigate('/');
  const handleNext = () => navigate('/learning/quiz/kp-123');
}
```

### 2.8 迁移清单
```
[ ] 安装 react-router-dom
[ ] 创建 src/router/routes.tsx
[ ] 创建 AppLayout 组件
[ ] 更新 App.tsx
[ ] 创建导航兼容层 (useAppNavigate)
[ ] 更新所有页面的导航调用 (自动化脚本可选)
    - 搜索所有 "const { navigate } = useUser()"
    - 替换为 "const navigate = useNavigate()"
    - 更新所有 navigate('page', params) 为 navigate('/path')
[ ] 删除 AppContext 中的 NAVIGATE action
[ ] 删除 currentPage, pageParams 状态
[ ] 更新 UserContext，删除导航相关逻辑
[ ] 测试所有路由
[ ] 测试浏览器后退/前进
[ ] 测试URL直接访问
[ ] 测试浏览器刷新
```

---

## 🎰 第3阶段：实现规则引擎

### 3.1 创建规则引擎基础
**文件创建：** `src/services/gamificationEngine.ts`

```typescript
export interface RuleContext {
  learningStats: {
    reviewCompleted: boolean;
    newItemsLearned: number;
    questionsAnswered: number;
    wrongCardsCount: number;
  };
  user: User;
  checkinStreak: number;
  timestamp: Date;
}

export interface RuleResult {
  canExecute: boolean;
  reason?: string;
  reward?: {
    coins: number;
    regularTickets: number;
    upTickets: number;
  };
}

export interface GameRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number; // 规则优先级
  execute: (context: RuleContext) => RuleResult;
}

export class GamificationEngine {
  private rules: Map<string, GameRule> = new Map();

  register(rule: GameRule) {
    this.rules.set(rule.id, rule);
  }

  unregister(ruleId: string) {
    this.rules.delete(ruleId);
  }

  checkCheckinConditions(context: RuleContext): {
    canCheckin: boolean;
    reason?: string;
    applicableRules: string[];
  } {
    const applicable: string[] = [];
    let canCheckin = false;
    let reason: string | undefined;

    // 按优先级排序规则
    const sortedRules = Array.from(this.rules.values())
      .filter(r => r.enabled && r.id.startsWith('checkin-'))
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      const result = rule.execute(context);
      if (result.canExecute) {
        applicable.push(rule.id);
        canCheckin = true;
      } else if (!reason) {
        reason = result.reason;
      }
    }

    return { canCheckin, reason, applicableRules: applicable };
  }

  checkAchievements(stats: LearningStats): Array<{ id: string; reward: Reward }> {
    const unlocked: Array<{ id: string; reward: Reward }> = [];

    // 检查所有成就规则
    const achievementRules = Array.from(this.rules.values())
      .filter(r => r.enabled && r.id.startsWith('achievement-'));

    for (const rule of achievementRules) {
      // 成就规则逻辑 ...
    }

    return unlocked;
  }

  getRule(ruleId: string): GameRule | undefined {
    return this.rules.get(ruleId);
  }

  getAllRules(): GameRule[] {
    return Array.from(this.rules.values());
  }
}

export const gamificationEngine = new GamificationEngine();
```

### 3.2 定义具体规则
**文件创建：** `src/config/gamificationRules.ts`

```typescript
import { gamificationEngine, GameRule, RuleContext, RuleResult } from '@/services/gamificationEngine';
import { STREAK_REWARDS } from '@/data/incentive-mock';

// ============= 签到规则 =============
const checkinBasicRule: GameRule = {
  id: 'checkin-basic',
  name: '基础签到条件',
  enabled: true,
  priority: 10,
  execute: (ctx: RuleContext): RuleResult => {
    const reviewCompleted = ctx.learningStats.reviewCompleted;
    const newItemsOk = ctx.learningStats.newItemsLearned >= 15;

    if (reviewCompleted && newItemsOk) {
      return {
        canExecute: true,
        reward: { coins: 0, regularTickets: 1, upTickets: 0 },
      };
    }

    return {
      canExecute: false,
      reason: !reviewCompleted ? '复习未完成' : '新学习数量不足',
    };
  },
};

const checkinQuizAlternativeRule: GameRule = {
  id: 'checkin-quiz',
  name: '做题签到条件',
  enabled: true,
  priority: 9,
  execute: (ctx: RuleContext): RuleResult => {
    const questionsOk = ctx.learningStats.questionsAnswered >= 10;

    return {
      canExecute: questionsOk,
      reason: !questionsOk ? `还需答 ${10 - ctx.learningStats.questionsAnswered} 题` : undefined,
      reward: questionsOk ? { coins: 0, regularTickets: 1, upTickets: 0 } : undefined,
    };
  },
};

const streakRewardRule: GameRule = {
  id: 'checkin-streak-reward',
  name: '连签奖励',
  enabled: true,
  priority: 5,
  execute: (ctx: RuleContext): RuleResult => {
    const streakReward = STREAK_REWARDS.find(r => r.days === ctx.checkinStreak);

    return {
      canExecute: !!streakReward,
      reward: streakReward,
    };
  },
};

// ============= 成就规则 =============
const firstFlashcardAchievement: GameRule = {
  id: 'achievement-first-flashcard',
  name: '初学者',
  enabled: true,
  priority: 1,
  execute: (ctx: RuleContext): RuleResult => ({
    canExecute: ctx.learningStats.questionsAnswered === 1,
    reward: { coins: 50, regularTickets: 0, upTickets: 0 },
  }),
};

// ============= 注册所有规则 =============
export function initializeGameRules() {
  gamificationEngine.register(checkinBasicRule);
  gamificationEngine.register(checkinQuizAlternativeRule);
  gamificationEngine.register(streakRewardRule);
  gamificationEngine.register(firstFlashcardAchievement);
  
  console.log('[GamificationEngine] Initialized with', gamificationEngine.getAllRules().length, 'rules');
}
```

### 3.3 在GamificationContext中使用规则引擎
**修改文件：** `src/store/GamificationContext.tsx`

```typescript
import { gamificationEngine } from '@/services/gamificationEngine';
import { useLearning } from './LearningContext';

export function useGamification() {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification must be used within GamificationProvider');
  }
  return context;
}

// 在GamificationProvider中
export function GamificationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gamificationReducer, initialState);
  const { learningState } = useLearning();

  // 检查新解锁的成就
  useEffect(() => {
    const stats = {
      checkinStreak: state.checkin.streak,
      questionsAnswered: learningState.quizResults.filter(
        r => r.completedAt.startsWith(getTodayString())
      ).length,
      // ... 其他统计
    };

    // 【TODO】定期检查新成就
  }, [learningState, state]);

  return (
    <GamificationContext.Provider value={{ state, dispatch, engine: gamificationEngine }}>
      {children}
    </GamificationContext.Provider>
  );
}

// 修改reducer中的CHECKIN case
function gamificationReducer(state: GamificationState, action: GamificationAction): GamificationState {
  switch (action.type) {
    case 'CHECKIN': {
      // 获取Learning数据用于规则检查
      const learningContext = getLearningContext(); // 需要传入
      
      const ruleContext: RuleContext = {
        learningStats: {
          reviewCompleted: learningContext.todayReviewItems.every(r => r.completed),
          newItemsLearned: learningContext.todayNewItems.filter(r => r.completed).length,
          questionsAnswered: learningContext.quizResults
            .filter(r => r.completedAt.startsWith(getTodayString())).length,
          wrongCardsCount: learningContext.wrongRecords.length,
        },
        user: state.user!,
        checkinStreak: state.checkin.streak,
        timestamp: new Date(),
      };

      // ✅ 使用规则引擎检查条件
      const checker = gamificationEngine.checkCheckinConditions(ruleContext);

      if (!checker.canCheckin) {
        return {
          ...state,
          checkinError: checker.reason,
        };
      }

      // 计算签到奖励
      const newRecord = { date: action.payload.date, type: action.payload.type, teamId: action.payload.teamId };
      const newRecords = [...state.checkin.records, newRecord];
      const streak = calculateStreak(newRecords);

      // 计算连签奖励
      const streakResult = gamificationEngine.getRule('checkin-streak-reward')
        ?.execute({ ...ruleContext, checkinStreak: streak });

      return {
        ...state,
        checkin: { ...state.checkin, records: newRecords, streak },
        drawBalance: {
          regular: state.drawBalance.regular + 1,
          up: state.drawBalance.up + (streakResult?.reward?.upTickets || 0),
        },
      };
    }
  }
}
```

### 3.4 迁移清单
```
[ ] 创建 GamificationEngine 类
[ ] 定义规则配置 (gamificationRules.ts)
[ ] 在 GamificationContext 中集成规则引擎
[ ] 将硬编码的签到逻辑迁移到规则
[ ] 将硬编码的成就逻辑迁移到规则
[ ] 创建规则动态加载系统（可选）
[ ] 添加规则生效/失效的管理界面（可选）
[ ] 测试所有规则
[ ] 添加规则单元测试
```

---

## 💾 第4阶段：统一持久化管理

### 4.1 实现PersistenceManager

**文件创建：** `src/services/persistenceManager.ts`

[参考主方案文档中的完整代码]

### 4.2 迁移现有持久化逻辑

```bash
# 第一步：备份当前 localStorage
# 浏览器开发者工具 → Application → Local Storage → 导出数据

# 第二步：逐Context迁移
# - LearningContext
# - GamificationContext  
# - UserContext
# - ThemeContext

# 第三步：验证数据一致性
npm test -- persistence
```

### 4.3 迁移清单
```
[ ] 安装 dexie (npm install dexie)
[ ] 创建 PersistenceManager
[ ] 注册所有需要持久化的数据
[ ] 更新 AppContext 使用新系统
[ ] 更新 LearningContext 使用新系统
[ ] 更新 GamificationContext 使用新系统
[ ] 创建数据备份/恢复功能
[ ] 测试迁移和恢复
[ ] 添加自动过期清理
```

---

## ✅ 验证和测试

### 测试清单（每个阶段后运行）

```bash
# 单元测试
npm test

# 覆盖率检查
npm run test:coverage

# E2E测试
npm run test:e2e

# 性能测试
npm run test:perf

# 检查构建大小
npm run build
# 查看 dist/stats.html
```

### 常见问题排查

**问题1：Context循环依赖**
```
错误：Cannot read property 'dispatch' of undefined
解决：检查Provider包裹顺序，避免内层Provider依赖外层状态
```

**问题2：数据不一致**
```
错误：LearningContext和GamificationContext数据不同步
解决：构建单向数据流，只在一个地方修改，其他地方订阅
```

**问题3：路由丢失状态**
```
错误：页面刷新后状态重置
解决：确保所有需要的状态都正确持久化，登录后恢复
```

---

## 📊 进度跟踪

使用此清单跟踪改进进度：

```markdown
## Phase 1: GamificationContext分离
- [x] 框架搭建
- [x] 状态转移
- [ ] 组件迁移 (30%)
- [ ] 单元测试 (0%)

## Phase 2: React Router迁移
- [ ] 依赖安装
- [ ] 路由定义
- [ ] 页面迁移 (0%)
- [ ] 导航更新 (0%)

# Phase 3: 规则引擎
- [ ] 引擎实现
- [ ] 规则迁移 (0%)
- [ ] 测试验证 (0%)

## Phase 4: 持久化管理
- [ ] 核心实现
- [ ] Context迁移 ( 0%)
- [ ] 备份恢复 (0%)

完成度: ████░░░░░░ 40%
```

---

## 🎓 学到的最佳实践

### 1. Context分离原则
- **单一责任**：每个Context只管理一个领域
- **数据流向**：单向数据流，避免双向绑定
- **中间件**：business logic独立，不混在reducer里

### 2. 持久化最佳实践  
- **分层存储**：根据数据大小和访问频率选择存储
- **版本控制**：每个数据结构都需要版本号
- **可恢复性**：始终保留备份和恢复机制

### 3. 路由最佳实践
- **URL为单一源头**：所有导航通过URL表达
- **深链接支持**：任何URL都能直接访问
- **浏览器原生特性**：支持后退、前进、书签

---

完成！现在可以开始第1阶段的实施了。

建议先从GamificationContext分离开始，这样改动最小化，也最容易回滚。

有任何问题，参考主方案文档或本指南相关部分。
