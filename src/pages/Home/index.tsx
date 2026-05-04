/**
 * ============================================================================
 * 首页 (Home Page)
 * ============================================================================
 *
 * 【双风格布局】
 *
 * 【Playful 风格】
 * 1. 渐变头部：问候语 + 用户昵称 + 连续学习天数 + AI 鼓励语
 * 2. 今日学习任务卡片：2列任务
 * 3. 学习总览：掌握度分布条 + 四级统计
 * 4. 每日福利：4宫格快捷入口
 * 5. 快速开始：emoji + 2x3网格
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
import { generateTodayReviewPlan, getGreeting, getEncouragement } from '@/utils/review';
import { getSmartEncouragement } from '@/services/aiService';
import { PROFICIENCY_MAP, UILAYOUT_CONFIGS } from '@/types';
import type { ProficiencyLevel } from '@/types';
import { Brain, Target, TrendingUp, ChevronRight, Sparkles, CalendarCheck, Trophy, ShoppingBag, Medal, Bot, Play, CheckCircle, BookOpen, Settings } from 'lucide-react';
import { ProgressBar } from '@/components/ui/Common';
import { FloatingAIPanel, TabBar } from '@/components/layout';

interface HomePageProps {
  isActive?: boolean;
}

export default function HomePage({ isActive = true }: HomePageProps) {

  const { state: appState, dispatch: appDispatch, getLearningStats } = useApp();
  const { learningState, learningDispatch } = useLearning();
  const { navigate } = useUser();
  const { theme } = useTheme();
  const stats = getLearningStats();

  const uiStyle = theme.uiStyle || 'playful';
  const layoutConfig = UILAYOUT_CONFIGS[uiStyle];

  // 本地缓存鼓励语，避免每次渲染随机变化
  const [fallbackEncouragement] = useState(() => getEncouragement());

  // 动画效果 - playful 风格使用动画
  const [animationEffect, setAnimationEffect] = useState(() => {
    const saved = localStorage.getItem('main-animation-effect');
    return saved || 'slide-up';
  });

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'main-animation-effect' && e.newValue) {
        setAnimationEffect(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const getAnimationClass = (delay: number) => {
    if (layoutConfig.animationStyle === 'simple') return '';
    const baseClass = `scroll-${animationEffect}`;
    const delayClass = `reveal-delay-${delay}`;
    return `${baseClass} ${delayClass}`;
  };

  // 生成今日复习计划
  useEffect(() => {
    const { review, newItems } = generateTodayReviewPlan(learningState.knowledgePoints, learningState.todayNewItems);
    learningDispatch({ type: 'SET_REVIEW_ITEMS', payload: { review, newItems } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Daily smart encouragement
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (appState.dailyEncouragementDate !== today) {
      getSmartEncouragement(stats, appState.wrongRecords.length, appState.checkin.streak)
        .then(text => {
          appDispatch({ type: 'SET_DAILY_ENCOURAGEMENT', payload: { text, date: today } });
        })
        .catch(() => { });
    }
  }, [appState.dailyEncouragementDate, appState.wrongRecords.length, appState.checkin.streak, appDispatch]);

  const encouragementText = appState.dailyEncouragement ?? fallbackEncouragement;

  // 学习数据
  const reviewPending = learningState.todayReviewItems.filter(r => !r.completed).length;
  const completedNew = learningState.todayNewItems.filter(r => r.completed).length;
  const dailyNewGoal = appState.user?.dailyNewGoal ?? 15;
  const reviewCompleted = reviewPending === 0;
  const newGoalCompleted = completedNew >= dailyNewGoal;
  const hasPendingNew = learningState.todayNewItems.filter(r => !r.completed).length > 0;
  const freeLearningMode = reviewCompleted && newGoalCompleted && hasPendingNew;
  const masteryCount = stats.masteredCount + stats.normalCount;

  const profData: { level: ProficiencyLevel; count: number }[] = [
    { level: 'master', count: stats.masteredCount },
    { level: 'normal', count: stats.normalCount },
    { level: 'rusty', count: stats.rustyCount },
    { level: 'none', count: stats.noneCount },
  ];

  const openPrimaryLearning = () => {
    if (reviewPending > 0) {
      navigate('review-session', { type: 'review' });
      return;
    }
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
      primaryIcon={Sparkles}
      primaryTitle="开始学习"
      onPrimaryAction={openPrimaryLearning}
    />
  );
  const todayDate = new Date().toISOString().slice(0, 10);
  const hasCheckedInToday = appState.checkin.records.some(record => record.date === todayDate);
  const completedReview = learningState.todayReviewItems.length - reviewPending;
  const totalReviewTasks = learningState.todayReviewItems.length;
  const totalCompletedTasks = completedReview + completedNew + (hasCheckedInToday ? 1 : 0);
  const mainTaskEntries = [
    {
      key: 'review',
      name: '完成今日复习',
      detail: reviewPending > 0 ? '优先清空待复习卡片' : '今日复习已完成',
      progress: `${completedReview}/${totalReviewTasks}`,
      ratio: totalReviewTasks > 0 ? completedReview / totalReviewTasks : 1,
      onClick: () => navigate('review-session', { type: 'review' }),
    },
    {
      key: 'new-learning',
      name: '推进新知识学习',
      detail: newGoalCompleted ? '今日新学目标已完成' : `还差 ${Math.max(dailyNewGoal - completedNew, 0)} 个知识点`,
      progress: `${completedNew}/${dailyNewGoal}`,
      ratio: dailyNewGoal > 0 ? Math.min(1, completedNew / dailyNewGoal) : 0,
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
    if (!newGoalCompleted) return `再学 ${dailyNewGoal - completedNew} 个知识点`;
    if (freeLearningMode) return '今日目标全部完成 🎉';
    if (hasCheckedInToday) return '保持节奏，继续前进';
    return '新的一天，从这里开始';
  }, [reviewPending, completedNew, newGoalCompleted, dailyNewGoal, freeLearningMode, hasCheckedInToday]);

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
      value: totalCompletedTasks,
      suffix: '项',
      label: '今日完成进度',
      hint: `待复习 ${reviewPending} 项 · 新学 ${completedNew}/${dailyNewGoal}`,
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
      <p className="text-[15px] font-medium" style={{ color: theme.textSecondary }}>
        {homeGreeting}
      </p>
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
          onClick={() => navigate(reviewPending > 0 ? 'review-session' : 'flashcard-learning', reviewPending > 0 ? { type: 'review' } : undefined)}
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
      <div className="relative flex h-full max-w-[430px] flex-col overflow-hidden" style={{ backgroundColor: theme.bg || '#F8FAFF' }}>
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
      </div>
    );
  }

  // ===== Playful 风格渲染（保持原有结构）=====
  return (
    <div className="relative h-full">
      <main className="absolute inset-x-0 top-0 bottom-[56px] overflow-y-auto pb-32 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Gradient Header */}
        <div
          className="text-white px-6 pt-5 pb-6 rounded-b-3xl overflow-hidden"
          style={{
            backgroundImage: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold">{getGreeting()}</h2>
              <p className="text-sm mt-0.5" style={{ color: '#ffffff' }}>{appState.user?.nickname ?? '同学'}</p>
            </div>
            <div className="bg-white/20 rounded-full px-3 py-1">
              <span className="text-sm">🔥 {stats.streakDays}天</span>
            </div>
          </div>

          {/* AI encouragement */}
          <button
            onClick={() => navigate('ai-chat')}
            className="w-full bg-white/10 rounded-xl p-3 flex items-start gap-2 active:bg-white/20 transition-colors text-left"
          >
            <Sparkles size={16} className="text-secondary-light mt-0.5 shrink-0" />
            <p className="text-sm flex-1" style={{ color: '#ffffff' }}>{encouragementText}</p>
            <ChevronRight size={14} className="text-white/50 mt-0.5 shrink-0" />
          </button>
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
                onClick={() => reviewPending > 0 && navigate('review-session', { type: 'review' })}
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
                onClick={() => {
                  if (reviewPending > 0) {
                    navigate('review-session', { type: 'review' });
                  } else {
                    navigate('review-session', { type: 'new' });
                  }
                }}
                className="text-left transition-transform active:scale-[0.97]"
                style={{
                  background: freeLearningMode
                    ? `linear-gradient(135deg, ${theme.success}20, ${theme.accent}20)`
                    : reviewPending > 0 || completedNew < dailyNewGoal
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
                  {freeLearningMode ? '🎉' : reviewPending > 0 ? `${reviewPending}` : `${completedNew}/${dailyNewGoal}`}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: freeLearningMode ? theme.accent : theme.primaryLight }}>
                  {freeLearningMode
                    ? '目标已完成，自由学习'
                    : reviewPending > 0
                      ? `待复习 + ${dailyNewGoal} 新学目标`
                      : `新学 ${completedNew}/${dailyNewGoal}`}
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

        {/* Incentive Shortcuts */}
        <div className={`mt-4 ${getAnimationClass(3)}`} style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">每日福利</h3>
          </div>

          <div className="grid grid-cols-4 gap-3 pr-20">
            <button
              onClick={() => navigate('checkin')}
              className="flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
              style={{
                backgroundColor: theme.bgCard,
                borderRadius: 'var(--card-radius)',
                padding: 'var(--card-padding)',
                boxShadow: theme.cardShadow !== 'none' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
                border: 'none',
              }}
            >
              <CalendarCheck size={20} style={{ color: theme.iconColors.checkin }} />
              <span className="text-[11px] font-medium" style={{ color: theme.textPrimary }}>签到</span>
            </button>

            <button
              onClick={() => navigate('achievements')}
              className="flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
              style={{
                backgroundColor: theme.bgCard,
                borderRadius: 'var(--card-radius)',
                padding: 'var(--card-padding)',
                boxShadow: theme.cardShadow !== 'none' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
                border: 'none',
              }}
            >
              <Trophy size={20} style={{ color: theme.iconColors.achievement }} />
              <span className="text-[11px] font-medium" style={{ color: theme.textPrimary }}>成就</span>
            </button>

            <button
              onClick={() => navigate('shop')}
              className="flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
              style={{
                backgroundColor: theme.bgCard,
                borderRadius: 'var(--card-radius)',
                padding: 'var(--card-padding)',
                boxShadow: theme.cardShadow !== 'none' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
                border: 'none',
              }}
            >
              <ShoppingBag size={20} style={{ color: theme.iconColors.shop }} />
              <span className="text-[11px] font-medium" style={{ color: theme.textPrimary }}>商城</span>
            </button>

            <button
              onClick={() => navigate('ranking')}
              className="flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
              style={{
                backgroundColor: theme.bgCard,
                borderRadius: 'var(--card-radius)',
                padding: 'var(--card-padding)',
                boxShadow: theme.cardShadow !== 'none' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
                border: 'none',
              }}
            >
              <Medal size={20} style={{ color: theme.iconColors.ranking }} />
              <span className="text-[11px] font-medium" style={{ color: theme.textPrimary }}>排行</span>
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className={`mt-4 ${getAnimationClass(4)}`} style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)' }}>
          <h3 className="font-semibold text-sm mb-3">快速开始</h3>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('quiz')}
              className="text-left active:scale-[0.97] transition-transform"
              style={{
                backgroundColor: theme.bgCard,
                borderRadius: 'var(--card-radius)',
                padding: 'var(--card-padding)',
                boxShadow: theme.cardShadow !== 'none' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
                border: 'none',
              }}
            >
              <div className="text-2xl mb-2">📝</div>
              <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>开始刷题</div>
              <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>选择题测试</div>
            </button>

            <button
              onClick={() => navigate('knowledge')}
              className="text-left active:scale-[0.97] transition-transform"
              style={{
                backgroundColor: theme.bgCard,
                borderRadius: 'var(--card-radius)',
                padding: 'var(--card-padding)',
                boxShadow: theme.cardShadow !== 'none' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
                border: 'none',
              }}
            >
              <div className="text-2xl mb-2">📚</div>
              <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>知识库</div>
              <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>管理知识点</div>
            </button>

            <button
              onClick={() => navigate('knowledge-map')}
              className="text-left active:scale-[0.97] transition-transform"
              style={{
                backgroundColor: theme.bgCard,
                borderRadius: 'var(--card-radius)',
                padding: 'var(--card-padding)',
                boxShadow: theme.cardShadow !== 'none' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
                border: 'none',
              }}
            >
              <div className="text-2xl mb-2">🗺️</div>
              <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>知识图谱</div>
              <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>可视化学习进度</div>
            </button>

            <button
              onClick={() => navigate('quiz', { tab: 'wrong' })}
              className="text-left active:scale-[0.97] transition-transform"
              style={{
                backgroundColor: theme.bgCard,
                borderRadius: 'var(--card-radius)',
                padding: 'var(--card-padding)',
                boxShadow: theme.cardShadow !== 'none' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
                border: 'none',
              }}
            >
              <div className="text-2xl mb-2">❌</div>
              <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>错题本</div>
              <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>{appState.wrongRecords.length} 道错题</div>
            </button>

            <button
              onClick={() => navigate('ai-chat')}
              className="text-left active:scale-[0.97] transition-transform"
              style={{
                background: `linear-gradient(135deg, ${theme.primary}20, ${theme.primaryLight}10)`,
                borderRadius: 'var(--card-radius)',
                padding: 'var(--card-padding)',
                border: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              <Bot size={24} style={{ color: theme.primary }} className="mb-2" />
              <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>AI 问答</div>
              <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>智能学习助手</div>
            </button>

            <button
              onClick={() => navigate('flashcard-learning')}
              className="text-left active:scale-[0.97] transition-transform"
              style={{
                backgroundColor: theme.bgCard,
                borderRadius: 'var(--card-radius)',
                padding: 'var(--card-padding)',
                boxShadow: theme.cardShadow !== 'none' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
                border: 'none',
              }}
            >
              <div className="text-2xl mb-2">🧠</div>
              <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>闪记学习</div>
              <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>记忆卡片式学习</div>
            </button>
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
    </div>
  );
}
