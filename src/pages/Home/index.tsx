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
  const dailyGoalPercent = Math.min(100, Math.round((todayLearningCount / dailyGoal) * 100));
  const remainingGoalCount = Math.max(dailyGoal - todayLearningCount, 0);
  const warmNextAction = reviewPending > 0 ? '先复习几张卡' : freeLearningMode ? '再加练一小组' : '开始新学一轮';
  const warmMoodText = reviewPending > 0
    ? '小书包提醒你：先把到期卡片清一清。'
    : freeLearningMode
      ? '今日目标完成了，可以轻松加练。'
      : `还差 ${remainingGoalCount} 项就能签到。`;

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
        {/* Warm Cartoon Header */}
        <div className="px-4 pt-4">
          <section
            className="relative overflow-hidden rounded-[32px] border p-5 shadow-[0_18px_44px_-28px_rgba(146,64,14,0.45)]"
            style={{
              background: 'radial-gradient(circle at 16% 18%, #ffffff 0 9%, transparent 10%), radial-gradient(circle at 88% 12%, #ffe7ba 0 16%, transparent 17%), linear-gradient(145deg, #fff7ed 0%, #ffedd5 52%, #fef3c7 100%)',
              borderColor: '#fed7aa',
            }}
          >
            <div className="absolute -left-6 top-8 h-16 w-16 rounded-full bg-white/60" />
            <div className="absolute right-12 top-7 h-8 w-16 rounded-full bg-white/70" />
            <div className="absolute right-5 top-12 h-6 w-12 rounded-full bg-white/60" />
            <div className="absolute -bottom-10 right-2 h-28 w-28 rounded-full bg-orange-200/55" />
            <div className="absolute bottom-5 left-6 h-2 w-2 rounded-full bg-orange-300" />
            <div className="absolute bottom-10 left-24 h-2 w-2 rounded-full bg-amber-300" />

            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold text-orange-700 shadow-sm">
                  <span>暖暖学习桌</span>
                  <span>🍞</span>
                </div>
                <h2 className="mt-3 text-[26px] font-black leading-tight text-orange-950">
                  {dynamicHeadline}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-orange-800/75">
                  {userState.user?.nickname ?? '同学'}，{warmMoodText}
                </p>
                <div className="mt-3 flex items-start gap-2 rounded-2xl bg-white/65 px-3 py-2 text-xs leading-relaxed text-orange-800/70">
                  <Sparkles size={14} className="mt-0.5 shrink-0 text-orange-500" />
                  <span className="line-clamp-2">{encouragementText}</span>
                </div>
              </div>
              <button
                onClick={() => navigate('settings')}
                className="shrink-0 rounded-2xl bg-white/75 p-2.5 text-orange-700 shadow-sm transition-transform active:scale-[0.97]"
                aria-label="设置"
              >
                <Settings size={18} />
              </button>
            </div>

            <div className="relative mt-5 flex items-end justify-between gap-4">
              <div className="min-w-0 flex-1 rounded-[24px] bg-white/72 p-4 shadow-[inset_0_0_0_1px_rgba(251,146,60,0.18)]">
                <div className="flex items-center justify-between text-xs font-bold text-orange-700">
                  <span>今日目标</span>
                  <span>{Math.min(todayLearningCount, dailyGoal)} / {dailyGoal}</span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-orange-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-400 via-amber-300 to-emerald-300 transition-all duration-500"
                    style={{ width: `${dailyGoalPercent}%` }}
                  />
                </div>
                <button
                  onClick={() => navigate('flashcard-learning')}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-orange-500 py-2.5 text-sm font-black text-white shadow-[0_10px_24px_-14px_rgba(234,88,12,0.8)] transition-transform active:scale-[0.98]"
                >
                  {warmNextAction}
                  <ChevronRight size={15} />
                </button>
              </div>

              <div className="relative flex h-[118px] w-[102px] shrink-0 items-end justify-center">
                <div className="absolute bottom-0 h-20 w-20 rounded-[28px] bg-orange-400 shadow-[inset_-8px_-10px_0_rgba(194,65,12,0.18)]" />
                <div className="absolute bottom-[54px] h-12 w-12 rounded-full bg-amber-200 shadow-sm" />
                <div className="absolute bottom-[70px] left-8 h-2 w-2 rounded-full bg-orange-950" />
                <div className="absolute bottom-[70px] right-8 h-2 w-2 rounded-full bg-orange-950" />
                <div className="absolute bottom-[61px] h-2 w-5 rounded-b-full border-b-2 border-orange-900" />
                <div className="absolute bottom-[18px] h-8 w-14 rounded-2xl bg-white/75 text-center text-2xl leading-8">📚</div>
              </div>
            </div>
          </section>
        </div>

        {/* Today's Route */}
        <div className={`mt-4 ${getAnimationClass(1)}`} style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)' }}>
          <section className="rounded-[30px] border border-orange-100 bg-white p-4 shadow-[0_14px_34px_-26px_rgba(146,64,14,0.5)]">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-black text-orange-950">
                <Target size={16} className="text-orange-500" />
                今日小路线
              </h3>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                {reviewPending > 0 ? '先复习' : freeLearningMode ? '已完成' : '新学中'}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <button
                onClick={() => navigate('flashcard-learning')}
                className="rounded-[22px] border p-3 text-left transition-transform active:scale-[0.97]"
                style={{
                  backgroundColor: reviewPending > 0 ? '#fff7ed' : '#f8fafc',
                  borderColor: reviewPending > 0 ? '#fdba74' : '#e2e8f0',
                }}
              >
                <div className="mb-2 text-2xl">🧺</div>
                <div className="text-xl font-black text-orange-950">{reviewPending}</div>
                <div className="text-[10px] font-bold text-orange-700/70">待复习</div>
              </button>

              <button
                onClick={() => navigate('flashcard-learning')}
                className="rounded-[22px] border border-emerald-100 bg-emerald-50 p-3 text-left transition-transform active:scale-[0.97]"
              >
                <div className="mb-2 text-2xl">🌱</div>
                <div className="text-xl font-black text-emerald-800">{Math.min(todayLearningCount, dailyGoal)}</div>
                <div className="text-[10px] font-bold text-emerald-700/70">已完成</div>
              </button>

              <button
                onClick={() => navigate('checkin')}
                className="rounded-[22px] border border-rose-100 bg-rose-50 p-3 text-left transition-transform active:scale-[0.97]"
              >
                <div className="mb-2 text-2xl">{hasCheckedInToday ? '🍓' : '🍯'}</div>
                <div className="text-xl font-black text-rose-700">{hasCheckedInToday ? '✓' : remainingGoalCount}</div>
                <div className="text-[10px] font-bold text-rose-700/70">{hasCheckedInToday ? '已签到' : '差几项'}</div>
              </button>
            </div>

            <button
              onClick={() => navigate('flashcard-learning')}
              className="mt-3 flex w-full items-center justify-between rounded-[22px] bg-orange-50 px-4 py-3 text-left transition-transform active:scale-[0.99]"
            >
              <div>
                <div className="text-sm font-black text-orange-950">{warmNextAction}</div>
                <div className="mt-0.5 text-xs text-orange-700/70">{warmMoodText}</div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-white">
                <Play size={16} fill="currentColor" />
              </div>
            </button>
          </section>
        </div>

        {/* Learning Garden */}
        <div className={`mt-4 ${getAnimationClass(2)}`} style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)' }}>
          <section className="rounded-[30px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-4 shadow-[0_14px_34px_-28px_rgba(6,95,70,0.45)]">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-black text-emerald-950">
                <TrendingUp size={16} className="text-emerald-500" />
                学习小花园
              </h3>
              <button onClick={() => navigate('profile')} className="flex items-center gap-0.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-700 shadow-sm">
                详情 <ChevronRight size={12} />
              </button>
            </div>

            <div className="mt-4 rounded-[24px] bg-white/75 p-4">
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-emerald-800/75">
                <span>掌握度分布</span>
                <span>共 {stats.totalKnowledgePoints} 个知识点</span>
              </div>
              <div className="flex h-4 overflow-hidden rounded-full bg-emerald-100">
                {profData.map(d => {
                  const pct = stats.totalKnowledgePoints > 0 ? (d.count / stats.totalKnowledgePoints) * 100 : 0;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={d.level}
                      className="h-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: PROFICIENCY_MAP[d.level].color }}
                    />
                  );
                })}
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2">
                {profData.map(d => (
                  <div key={d.level} className="rounded-2xl bg-white p-2 text-center shadow-sm">
                    <div className="text-lg font-black" style={{ color: PROFICIENCY_MAP[d.level].color }}>
                      {d.count}
                    </div>
                    <div className="text-[10px] font-bold" style={{ color: theme.textSecondary }}>{PROFICIENCY_MAP[d.level].label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-[22px] bg-white/70 px-3 py-2.5">
              <span className="text-2xl">🌼</span>
              <p className="min-w-0 flex-1 text-xs leading-relaxed text-emerald-800/70">
                每完成一项学习，花园就多长一点；完成目标后还能继续加练一组。
              </p>
            </div>
          </section>
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
