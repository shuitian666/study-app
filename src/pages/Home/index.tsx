/**
 * ============================================================================
 * 首页 (Home Page)
 * ============================================================================
 *
 * 【双风格布局】
 *
 * 【Playful 风格】
 * 1. 问候卡片：目标进度 + 用户昵称 + 连续学习天数 + AI 鼓励语
 * 2. 今日学习任务卡片：2列任务
 * 3. 学习总览：掌握度分布条 + 四级统计
 *
 * 【Scholar 风格 - Fluid Scholar 设计系统】
 * 1. TopAppBar 顶部导航栏
 * 2. 问候区 + 连续学习天数
 * 3. Bento Grid 布局（今日任务、统计、AI Banner）
 * 4. 快捷入口（Material Icons）
 * 5. Floating AI Button
 * ============================================================================
 */

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/store/AppContext';
import { useLearning } from '@/store/LearningContext';
import { useUser } from '@/store/UserContext';
import { useTheme } from '@/store/ThemeContext';
import { useGame } from '@/store/GameContext';
import { generateTodayReviewPlan, getGreeting, getEncouragement } from '@/utils/review';
import { getTodayLearningProgress } from '@/utils/dailyLearningProgress';
import { getSmartEncouragement } from '@/services/aiService';
import { PROFICIENCY_MAP, UILAYOUT_CONFIGS } from '@/types';
import type { ProficiencyLevel } from '@/types';
import { Brain, Target, TrendingUp, ChevronRight, Sparkles, CalendarCheck, Trophy, ShoppingBag, Medal, Bot, Play, CheckCircle, BookOpen, Settings } from 'lucide-react';
import { ProgressBar } from '@/components/ui/Common';
import OnboardingGuide from '@/components/ui/OnboardingGuide';
import { FloatingAIPanel, TabBar } from '@/components/layout';

interface HomePageProps {
  isActive?: boolean;
}

const ONBOARDING_STORAGE_KEY = 'study-app:onboarding-completed:v1';
const ONBOARDING_FORCE_OPEN_KEY = 'study-app:onboarding-force-open:v1';

export default function HomePage({ isActive = true }: HomePageProps) {

  const { state: appState, dispatch: appDispatch } = useApp();
  const { learningState, learningDispatch, getLearningStats } = useLearning();
  const { userState, userDispatch, navigate } = useUser();
  const { gameState } = useGame();
  const { theme } = useTheme();
  const stats = getLearningStats();

  const uiStyle = theme.uiStyle || 'playful';
  const layoutConfig = UILAYOUT_CONFIGS[uiStyle];

  // 本地缓存鼓励语，避免每次渲染随机变化
  const [fallbackEncouragement] = useState(() => getEncouragement());
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const getAnimationClass = (delay: number) => {
    if (layoutConfig.animationStyle === 'simple') return '';
    return `scroll-slide-up reveal-delay-${delay}`;
  };

  // 生成今日复习计划
  useEffect(() => {
    const { review, newItems } = generateTodayReviewPlan(learningState.knowledgePoints, learningState.todayNewItems);
    learningDispatch({ type: 'SET_REVIEW_ITEMS', payload: { review, newItems } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isActive || userState.currentPage !== 'home') return;

    try {
      const shouldForceOpen =
        userState.pageParams.showGuide === '1' ||
        localStorage.getItem(ONBOARDING_FORCE_OPEN_KEY) === '1';

      // Always clear the force-open key first, so any subsequent crash won't loop
      localStorage.removeItem(ONBOARDING_FORCE_OPEN_KEY);

      if (shouldForceOpen) {
        setIsGuideOpen(true);
        userDispatch({ type: 'NAVIGATE', payload: { page: 'home' } });
        return;
      }

      const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
      if (!hasCompletedOnboarding) {
        setIsGuideOpen(true);
      }
    } catch (e) {
      console.error('[Home] onboarding effect error', e);
    }
  }, [isActive, userDispatch, userState.currentPage, userState.pageParams.showGuide]);

  const handleCloseGuide = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
    setIsGuideOpen(false);
  };

  // Daily smart encouragement
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (appState.dailyEncouragementDate !== today) {
      getSmartEncouragement(stats, learningState.wrongRecords.length, gameState.checkin.streak)
        .then(text => {
          appDispatch({ type: 'SET_DAILY_ENCOURAGEMENT', payload: { text, date: today } });
        })
        .catch(() => { });
    }
  }, [appState.dailyEncouragementDate, learningState.wrongRecords.length, gameState.checkin.streak, appDispatch, stats]);

  const encouragementText = appState.dailyEncouragement ?? fallbackEncouragement;

  // 学习数据
  const reviewPending = learningState.todayReviewItems.filter(r => !r.completed).length;
  const completedNew = learningState.todayNewItems.filter(r => r.completed).length;
  const dailyGoal = Math.max(1, userState.user?.dailyGoal ?? 10);
  const todayLearningProgress = getTodayLearningProgress(learningState);
  const todayLearningCount = todayLearningProgress.totalCount;
  const dailyGoalCompleted = todayLearningCount >= dailyGoal;
  const freeLearningMode = dailyGoalCompleted;
  const masteryCount = stats.masteredCount + stats.normalCount;

  const profData: { level: ProficiencyLevel; count: number }[] = [
    { level: 'master', count: stats.masteredCount },
    { level: 'normal', count: stats.normalCount },
    { level: 'rusty', count: stats.rustyCount },
    { level: 'none', count: stats.noneCount },
  ];

  const openPrimaryLearning = () => {
    navigate('flashcard-learning');
  };

  const homeFabMenuItems = useMemo(() => [
    {
      id: 'checkin',
      label: '签到',
      icon: CalendarCheck,
      onSelect: () => navigate('checkin'),
      accentColor: '#10b981',
      backgroundColor: theme.bgCard,
    },
    {
      id: 'achievements',
      label: '成就',
      icon: Trophy,
      onSelect: () => navigate('achievements'),
      accentColor: '#f59e0b',
      backgroundColor: theme.bgCard,
    },
    {
      id: 'shop',
      label: '商店',
      icon: ShoppingBag,
      onSelect: () => navigate('shop'),
      accentColor: '#8b5cf6',
      backgroundColor: theme.bgCard,
    },
    {
      id: 'ranking',
      label: '排名',
      icon: Medal,
      onSelect: () => navigate('ranking'),
      accentColor: '#ef4444',
      backgroundColor: theme.bgCard,
    },
    {
      id: 'study-assistant',
      label: '学习',
      icon: BookOpen,
      onSelect: openPrimaryLearning,
      accentColor: theme.primary,
      backgroundColor: theme.bgCard,
    },
  ], [navigate, openPrimaryLearning, theme.bgCard, theme.primary]);

  const isActiveHomePage = isActive;
  const homeContainedTabBar = <TabBar placement="contained" />;
  const homeFloatingPanel = (
    <FloatingAIPanel
      menuItems={homeFabMenuItems}
      placement="contained"
      ownerPage="home"
      primaryIcon={Sparkles}
      primaryTitle="开始学习"
      onPrimaryAction={openPrimaryLearning}
    />
  );
  const todayDate = new Date().toISOString().slice(0, 10);
  const hasCheckedInToday = gameState.checkin.records.some(record => record.date === todayDate);
  const completedReview = learningState.todayReviewItems.length - reviewPending;
  const totalReviewTasks = learningState.todayReviewItems.length;
  const mainTaskEntries = [
    {
      key: 'review',
      name: '完成今日复习',
      detail: reviewPending > 0 ? '优先清空待复习卡片' : '今日复习已完成',
      progress: `${completedReview}/${totalReviewTasks}`,
      ratio: totalReviewTasks > 0 ? completedReview / totalReviewTasks : 1,
      onClick: () => navigate('flashcard-learning'),
    },
    {
      key: 'new-learning',
      name: '完成今日目标',
      detail: dailyGoalCompleted ? '今日学习目标已完成' : `还差 ${Math.max(dailyGoal - todayLearningCount, 0)} 项学习量`,
      progress: `${Math.min(todayLearningCount, dailyGoal)}/${dailyGoal}`,
      ratio: Math.min(1, todayLearningCount / dailyGoal),
      onClick: () => navigate('flashcard-learning'),
    },
    {
      key: 'checkin',
      name: '保持签到节奏',
      detail: hasCheckedInToday ? '今天已经签到，继续保持' : '完成签到，点亮今日状态',
      progress: hasCheckedInToday ? '1/1' : '0/1',
      ratio: hasCheckedInToday ? 1 : 0,
      onClick: () => navigate('checkin'),
    },
  ];

  const accentPrimary = theme.primary || '#4f46e5';
  const accentSurface = theme.onSurface || '#0f172a';
  const rawGreeting = getGreeting();
  const homeGreeting = `${rawGreeting.split('，')[0]}，继续加油`;
  const dynamicHeadline = useMemo(() => {
    if (reviewPending > 0 && completedNew === 0) return `先清掉 ${reviewPending} 张复习卡`;
    if (reviewPending > 0) return `还有 ${reviewPending} 张卡待复习`;
    if (!dailyGoalCompleted) return `再完成 ${dailyGoal - todayLearningCount} 项学习量`;
    if (freeLearningMode) return '今日目标全部完成 🎉';
    if (hasCheckedInToday) return '保持节奏，继续前进';
    return '新的一天，从这里开始';
  }, [reviewPending, completedNew, dailyGoalCompleted, dailyGoal, todayLearningCount, freeLearningMode, hasCheckedInToday]);

  const scholarStatsCards = [
    {
      key: 'mastery',
      icon: Trophy,
      value: masteryCount,
      suffix: '张',
      label: '掌握卡片',
      hint: '进入稳定掌握区间',
      accent: accentPrimary,
      chipBg: `${accentPrimary}1E`,
      glow: `${accentPrimary}24`,
    },
    {
      key: 'today-finished',
      icon: CheckCircle,
      value: todayLearningCount,
      suffix: '项',
      label: '今日完成进度',
      hint: `待复习 ${reviewPending} 项 · 目标 ${Math.min(todayLearningCount, dailyGoal)}/${dailyGoal}`,
      accent: theme.accent || '#0ea5e9',
      chipBg: `${theme.accent || '#0ea5e9'}1E`,
      glow: `${theme.accent || '#0ea5e9'}38`,
    },
  ];

  const scholarTaskEntries = [
    {
      ...mainTaskEntries[0],
      icon: Brain,
      accent: '#6366f1',
      softBg: 'rgba(99, 102, 241, 0.1)',
    },
    {
      ...mainTaskEntries[1],
      icon: TrendingUp,
      accent: '#f59e0b',
      softBg: 'rgba(245, 158, 11, 0.12)',
    },
    {
      ...mainTaskEntries[2],
      icon: CalendarCheck,
      accent: '#10b981',
      softBg: 'rgba(16, 185, 129, 0.12)',
    },
  ];

  const BrandHeader = () => (
    <header className="mb-7 flex h-12 w-full items-center justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
          style={{ backgroundColor: theme.bgCard, color: theme.primary }}
        >
          <BookOpen size={20} />
        </div>
        <div className="min-w-0">
          <div
            className="truncate text-lg font-bold tracking-tight"
            style={{ color: theme.textPrimary, fontFamily: 'Plus Jakarta Sans, Noto Sans SC, sans-serif' }}
          >
            The Fluid Scholar
          </div>
          <div className="text-[10px] uppercase tracking-[0.28em]" style={{ color: theme.textMuted }}>
            SMART STUDY
          </div>
        </div>
      </div>
      <button
        onClick={() => navigate('settings')}
        className="flex h-11 w-11 items-center justify-center rounded-full border shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition-transform duration-200 active:scale-[0.97]"
        style={{ borderColor: theme.border, backgroundColor: theme.bgCard, color: theme.textSecondary }}
        aria-label="设置"
      >
        <Settings size={18} />
      </button>
    </header>
  );

  const GreetingBlock = () => (
    <section className="mb-7 w-full">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-medium" style={{ color: theme.textSecondary }}>
          {homeGreeting}
        </p>
        {stats.streakDays > 0 && (
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
            style={{
              backgroundColor: `${theme.secondaryFixed || '#ffdfa0'}cc`,
              color: theme.onSecondaryFixedVariant || '#5c4300',
            }}
          >
            🔥 {stats.streakDays} 天
          </div>
        )}
      </div>
      <h1
        className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight"
        style={{ color: theme.textPrimary, fontFamily: 'Plus Jakarta Sans, Noto Sans SC, sans-serif' }}
      >
        {dynamicHeadline}
      </h1>
    </section>
  );

  const StatsGrid = () => (
    <section className="mb-7 grid w-full grid-cols-2 gap-4">
      {scholarStatsCards.map(card => {
        const Icon = card.icon;
        return (
          <article
            key={card.key}
            className="relative min-h-[136px] overflow-hidden rounded-[var(--radius-xl)] p-5 shadow-[0_4px_16px_rgba(15,23,42,0.10)]"
            style={{ backgroundColor: theme.bgCard, border: `1.5px solid ${theme.border}` }}
          >
            <div
              className="absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl"
              style={{ background: card.glow }}
            />
            <div className="relative flex h-full flex-col">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-full"
                style={{ background: card.chipBg, color: card.accent }}
              >
                <Icon size={19} />
              </div>
              <div className="mt-6 flex items-end gap-1.5">
                <span
                  className="text-[34px] font-extrabold leading-none tracking-tight"
                  style={{ color: accentSurface, fontFamily: 'Plus Jakarta Sans, Noto Sans SC, sans-serif' }}
                >
                  {card.value}
                </span>
                <span className="pb-1 text-sm" style={{ color: theme.textSecondary }}>
                  {card.suffix}
                </span>
              </div>
              <div className="mt-4 space-y-1.5">
                <p className="text-sm font-bold" style={{ color: theme.textPrimary }}>{card.label}</p>
                <p className="text-xs leading-relaxed" style={{ color: theme.textSecondary }}>{card.hint}</p>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );

  const AICtaBanner = () => (
    <section
      className="mb-7 w-full overflow-hidden rounded-[var(--radius-xl)] p-6"
      style={{
        background: `linear-gradient(135deg, ${theme.primaryFixed || '#dee0ff'} 0%, ${theme.bgCard || '#ffffff'} 100%)`,
        border: `1.5px solid ${theme.primary}22`,
        boxShadow: `0 8px 28px ${theme.primary}14`,
      }}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h3
            className="text-xl font-extrabold leading-snug"
            style={{ color: theme.textPrimary, fontFamily: 'Plus Jakarta Sans, Noto Sans SC, sans-serif' }}
          >
            AI 辅导，学习更高效
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed" style={{ color: theme.textSecondary }}>
            答疑、复习、规划，一起完成今天的学习。
          </p>
        </div>
        <div
          className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primary}bb 100%)`,
            boxShadow: `0 10px 24px ${theme.primary}38`,
          }}
        >
          <Bot size={30} strokeWidth={1.6} color="white" />
        </div>
      </div>
      <button
        onClick={() => navigate('ai-chat')}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-semibold text-white transition-transform duration-200 active:scale-[0.98] hover:opacity-90"
        style={{ backgroundColor: theme.primary, boxShadow: `0 6px 18px ${theme.primary}40` }}
      >
        立即开始
        <ChevronRight size={15} />
      </button>
    </section>
  );

  const TodayTasksCard = () => (
    <section className="mt-7 w-full">
      <div className="mb-4 flex items-center justify-between pr-20">
        <h3
          className="text-xl font-extrabold tracking-tight"
          style={{ color: theme.textPrimary, fontFamily: 'Plus Jakarta Sans, Noto Sans SC, sans-serif' }}
        >
          今日任务
        </h3>
        <button
          onClick={() => navigate('flashcard-learning')}
          className="inline-flex items-center gap-1 text-sm font-semibold"
          style={{ color: theme.primary }}
        >
          查看全部
          <ChevronRight size={16} />
        </button>
      </div>

      <div
        className="overflow-hidden rounded-[var(--radius-xl)] shadow-[0_14px_36px_rgba(15,23,42,0.05)]"
        style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
      >
        {scholarTaskEntries.map(task => {
          const Icon = task.icon;
          return (
            <button
              key={task.key}
              onClick={task.onClick}
              className="flex min-h-[76px] w-full items-center px-5 text-left transition-colors duration-200"
            >
              <div className="flex min-h-[76px] w-full items-center border-b last:border-b-0" style={{ borderColor: theme.border }}>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: task.softBg, color: task.accent }}>
                  <Icon size={19} />
                </div>
                <div className="ml-3 min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold" style={{ color: theme.textPrimary }}>{task.name}</p>
                  <p className="mt-1 truncate text-xs" style={{ color: theme.textSecondary }}>{task.detail}</p>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: `${task.accent}1A` }}>
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.round(task.ratio * 100)}%`,
                        backgroundColor: task.ratio >= 1 ? '#10b981' : task.accent,
                      }}
                    />
                  </div>
                </div>
                <span className="ml-3 shrink-0 text-sm font-bold" style={{ color: task.accent }}>
                  {task.progress}
                </span>
                <ChevronRight className="ml-1 shrink-0" size={18} style={{ color: theme.textMuted }} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );


  // ===== Scholar 风格渲染 =====
  if (uiStyle === 'scholar') {
    return (
      <div className="relative flex h-full max-w-[430px] flex-col overflow-hidden" style={{ background: `linear-gradient(175deg, ${theme.primaryFixed || '#dee0ff'}44 0%, ${theme.bg || '#F8FAFF'} 35%)` }}>
        <main className="h-full overflow-y-auto px-6 pb-[132px] pt-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <BrandHeader />
          <GreetingBlock />
          <StatsGrid />
          <AICtaBanner />
          <TodayTasksCard />
        </main>
        {isActiveHomePage && (
          <div className="absolute bottom-0 left-0 right-0 z-40">
            {homeContainedTabBar}
          </div>
        )}
        {isActiveHomePage && (
          <div className="absolute bottom-[82px] right-6 z-50">
            {homeFloatingPanel}
          </div>
        )}
        <OnboardingGuide
          open={isGuideOpen}
          onClose={handleCloseGuide}
        />
      </div>
    );
  }

  // ===== Playful 风格渲染（保持原有结构）=====
  return (
    <div className="relative h-full">
      <main className="absolute inset-x-0 top-0 bottom-[56px] overflow-y-auto pb-32 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Greeting Card */}
        <div className="px-5 pt-5">
          <section
            className="relative overflow-hidden rounded-[28px] border p-5 shadow-[0_16px_36px_-24px_rgba(15,23,42,0.45)]"
            style={{
              background: `radial-gradient(circle at 90% 12%, ${theme.primary}20, transparent 34%), linear-gradient(135deg, ${theme.bgCard}, ${theme.primary}0F)`,
              borderColor: theme.border,
            }}
          >
            <div
              className="absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl"
              style={{ backgroundColor: `${theme.primary}22` }}
            />
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium" style={{ color: theme.textMuted }}>{getGreeting()}</p>
                <h2 className="mt-1 text-2xl font-black leading-tight" style={{ color: theme.textPrimary }}>
                  {dynamicHeadline}
                </h2>
                <p className="mt-1 text-sm" style={{ color: theme.textSecondary }}>
                  {userState.user?.nickname ?? '同学'}，今日已完成 {todayLearningCount}/{dailyGoal} 项
                </p>
              </div>
              <button
                onClick={() => navigate('settings')}
                className="shrink-0 rounded-2xl p-2.5 active:scale-[0.97] transition-transform"
                style={{ backgroundColor: `${theme.primary}14`, color: theme.primary }}
                aria-label="设置"
              >
                <Settings size={18} />
              </button>
            </div>

            <div className="relative mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl px-3 py-2.5" style={{ backgroundColor: `${theme.primary}12` }}>
                <div className="text-lg font-bold" style={{ color: theme.primary }}>{stats.streakDays} 天</div>
                <div className="text-[10px]" style={{ color: theme.textSecondary }}>连续学习</div>
              </div>
              <div className="rounded-2xl px-3 py-2.5" style={{ backgroundColor: `${theme.secondary}16` }}>
                <div className="text-lg font-bold" style={{ color: theme.secondary }}>{userState.user?.totalPoints ?? 0}</div>
                <div className="text-[10px]" style={{ color: theme.textSecondary }}>星币余额</div>
              </div>
            </div>

            <button
              onClick={() => navigate('ai-chat')}
              className="relative mt-4 w-full rounded-2xl p-3 flex items-start gap-2 active:scale-[0.99] transition-transform text-left"
              style={{ backgroundColor: theme.bg, color: theme.textPrimary }}
            >
              <Sparkles size={16} className="mt-0.5 shrink-0" style={{ color: theme.primary }} />
              <p className="text-sm flex-1" style={{ color: theme.textSecondary }}>{encouragementText}</p>
              <ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: theme.textMuted }} />
            </button>
          </section>
        </div>

        {/* Today's Tasks */}
        <div className={`mt-4 ${getAnimationClass(1)}`} style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)' }}>
          <div
            style={{
              backgroundColor: theme.bgCard,
              borderRadius: 'var(--card-radius)',
              padding: 'var(--card-padding)',
              boxShadow: theme.cardShadow !== 'none' ? '0 4px 12px -2px rgba(0, 0, 0, 0.1)' : 'none',
              border: `1px solid ${theme.border}`,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                <Target size={16} style={{ color: theme.primary }} />
                今日学习任务
              </h3>
              <span className="text-xs" style={{ color: theme.textMuted }}>
                {reviewPending > 0 ? '复习中' : freeLearningMode ? '目标完成 🎉' : '新学中'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('flashcard-learning')}
                className="text-left transition-transform active:scale-[0.97]"
                style={{
                  background: reviewPending > 0
                    ? `linear-gradient(135deg, ${theme.secondaryLight}20, ${theme.secondary}20)`
                    : theme.bgCard,
                  borderRadius: 'var(--card-radius)',
                  padding: 'var(--card-padding)',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Brain size={14} style={{ color: reviewPending > 0 ? theme.secondary : theme.textMuted }} />
                  <span className="text-xs font-medium" style={{ color: reviewPending > 0 ? theme.secondary : theme.textMuted }}>待复习</span>
                </div>
                <div className="text-2xl font-bold" style={{ color: reviewPending > 0 ? theme.secondary : theme.textMuted }}>{reviewPending}</div>
                <div className="text-[10px] mt-0.5" style={{ color: reviewPending > 0 ? theme.secondaryLight : theme.textMuted }}>个知识点</div>
              </button>

              <button
                onClick={() => navigate('flashcard-learning')}
                className="text-left transition-transform active:scale-[0.97]"
                style={{
                  background: freeLearningMode
                    ? `linear-gradient(135deg, ${theme.success}20, ${theme.accent}20)`
                    : reviewPending > 0 || !dailyGoalCompleted
                      ? `linear-gradient(135deg, ${theme.primary}20, ${theme.primaryLight}20)`
                      : `linear-gradient(135deg, ${theme.success}20, ${theme.accent}20)`,
                  borderRadius: 'var(--card-radius)',
                  padding: 'var(--card-padding)',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {freeLearningMode ? (
                    <CheckCircle size={14} style={{ color: theme.success }} />
                  ) : (
                    <Play size={14} style={{ color: theme.primary }} />
                  )}
                  <span className="text-xs font-medium" style={{ color: freeLearningMode ? theme.success : theme.primary }}>
                    {freeLearningMode ? '自由学习' : '开始学习'}
                  </span>
                </div>
                <div className="text-2xl font-bold" style={{ color: freeLearningMode ? theme.success : theme.primary }}>
                  {freeLearningMode ? '🎉' : reviewPending > 0 ? `${reviewPending}` : `${Math.min(todayLearningCount, dailyGoal)}/${dailyGoal}`}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: freeLearningMode ? theme.accent : theme.primaryLight }}>
                  {freeLearningMode
                    ? '目标已完成，自由学习'
                    : reviewPending > 0
                      ? `待复习 + ${dailyGoal} 项目标`
                      : `目标 ${Math.min(todayLearningCount, dailyGoal)}/${dailyGoal}`}
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Learning Overview */}
        <div className={`mt-4 ${getAnimationClass(2)}`} style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-1.5">
              <TrendingUp size={16} style={{ color: theme.primary }} />
              学习总览
            </h3>
            <button onClick={() => navigate('profile')} className="text-xs flex items-center gap-0.5" style={{ color: theme.primary }}>
              详情 <ChevronRight size={12} />
            </button>
          </div>

          <div
            style={{
              backgroundColor: theme.bgCard,
              borderRadius: 'var(--card-radius)',
              padding: 'var(--card-padding)',
              boxShadow: theme.cardShadow !== 'none' ? '0 4px 12px -2px rgba(0, 0, 0, 0.1)' : 'none',
              border: 'none',
            }}
          >
            <div className="flex items-center justify-between text-xs mb-2">
              <span style={{ color: theme.textSecondary }}>掌握度分布</span>
              <span style={{ color: theme.textSecondary }}>共 {stats.totalKnowledgePoints} 个知识点</span>
            </div>

            <ProgressBar value={stats.masteredCount + stats.normalCount} max={stats.totalKnowledgePoints} color="bg-accent" />
            <div className="grid grid-cols-4 gap-2 mt-3">
              {profData.map(d => (
                <div key={d.level} className="text-center">
                  <div className="text-lg font-bold" style={{ color: PROFICIENCY_MAP[d.level].color }}>
                    {d.count}
                  </div>
                  <div className="text-[10px]" style={{ color: theme.textSecondary }}>{PROFICIENCY_MAP[d.level].label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Weak Subjects */}
        {stats.weakSubjects.length > 0 && (
          <div className={`mt-4 ${getAnimationClass(5)}`} style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)', paddingBottom: '24px' }}>
            <div
              style={{
                backgroundColor: `${theme.danger}15`,
                borderRadius: 'var(--card-radius)',
                padding: 'var(--card-padding)',
                border: `1px solid ${theme.danger}30`,
              }}
            >
              <h4 className="text-sm font-medium mb-2" style={{ color: theme.danger }}>⚠️ 薄弱学科提醒</h4>
              <div className="flex flex-wrap gap-2">
                {stats.weakSubjects.map(s => (
                  <span
                    key={s}
                    className="text-xs px-2 py-1 rounded-full"
                    style={{
                      backgroundColor: `${theme.danger}20`,
                      color: theme.danger
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>
      {isActiveHomePage && (
        <div className="absolute inset-x-0 bottom-0 z-40">
          {homeContainedTabBar}
        </div>
      )}
      {isActiveHomePage && (
        <div className="absolute bottom-[70px] right-5 z-[80]">
          {homeFloatingPanel}
        </div>
      )}
      <OnboardingGuide
        open={isGuideOpen}
        onClose={handleCloseGuide}
      />
    </div>
  );
}
