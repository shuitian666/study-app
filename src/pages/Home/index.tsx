/**
 * Home Page
 *
 * The default theme uses the cozy notebook direction from the Figma draft.
 * Fluid Scholar keeps the same data surface with a quieter shell.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Bot,
  Brain,
  Bell,
  CalendarCheck,
  CheckCircle,
  CheckCircle2,
  ChevronRight,
  Circle,
  Cloud,
  Download,
  Leaf,
  Medal,
  PenLine,
  Play,
  RefreshCw,
  Settings,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { FloatingAIPanel, TabBar } from '@/components/layout';
import OnboardingGuide from '@/components/ui/OnboardingGuide';
import { useGame } from '@/store/GameContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { useUser } from '@/store/UserContext';
import { accountUpdateProfile } from '@/services/aiClient';
import { getSmartEncouragement } from '@/services/aiService';
import { downloadKnowledgeFromOSS, getAvailableKnowledgeBases, type KnowledgeSubject } from '@/services/ossService';
import { getTodayLearningProgress } from '@/utils/dailyLearningProgress';
import { generateTodayReviewPlan, getEncouragement, getGreeting } from '@/utils/review';
import { getAdaptiveButton, getAdaptivePageBackground, isDarkTheme } from '@/utils/adaptiveTheme';
import { getRecommendedPackages, STUDY_DIRECTIONS, type StudyDirection } from '@/utils/contentPackages';
import {
  getReviewReminderSettings,
  requestReviewReminderPermission,
  scheduleReviewReminder,
} from '@/utils/reviewReminder';
import { PROFICIENCY_MAP } from '@/types';
import type { ProficiencyLevel } from '@/types';
import { normalizeLearningProfile } from '@/utils/aiLearningContext';

interface HomePageProps {
  isActive?: boolean;
}

const ONBOARDING_STORAGE_KEY = 'study-app:onboarding-completed:v1';
const ONBOARDING_FORCE_OPEN_KEY = 'study-app:onboarding-force-open:v1';

const paperPalette = {
  bg: '#ffffff',
  ink: '#1f2933',
  muted: '#667085',
  faint: '#98a2b3',
  card: '#ffffff',
  line: '#e5e7eb',
  green: '#7fb069',
  greenSoft: '#eaf4dd',
  amber: '#d99536',
  amberSoft: '#fff3dc',
  rose: '#c58b84',
  roseSoft: '#f8e6df',
  blue: '#87a8a4',
  blueSoft: '#e8f1ef',
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function HomePage({ isActive = true }: HomePageProps) {
  const { gameState } = useGame();
  const { learningState, learningDispatch, syncStatus, retryLearningSync, getLearningStats } = useLearning();
  const { theme } = useTheme();
  const { userState, userDispatch, navigate } = useUser();
  const stats = getLearningStats();
  const [fallbackEncouragement] = useState(() => getEncouragement());
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeSubject[]>([]);
  const [selectedDirection, setSelectedDirection] = useState<StudyDirection>('medical');
  const [claimingPackageId, setClaimingPackageId] = useState<string | null>(null);
  const [contentPackageError, setContentPackageError] = useState<string | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(() => getReviewReminderSettings().enabled);

  useEffect(() => {
    const { review, newItems } = generateTodayReviewPlan(
      learningState.knowledgePoints,
      learningState.todayNewItems,
    );
    learningDispatch({ type: 'SET_REVIEW_ITEMS', payload: { review, newItems } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isActive || userState.currentPage !== 'home') return;

    try {
      const shouldForceOpen =
        userState.pageParams.showGuide === '1' ||
        localStorage.getItem(ONBOARDING_FORCE_OPEN_KEY) === '1';

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
    } catch (error) {
      console.error('[Home] onboarding effect error', error);
    }
  }, [isActive, userDispatch, userState.currentPage, userState.pageParams.showGuide]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (userState.dailyEncouragementDate === today) return;

    getSmartEncouragement(stats, learningState.wrongRecords.length, gameState.checkin.streak)
      .then(text => {
        userDispatch({ type: 'SET_DAILY_ENCOURAGEMENT', payload: { text, date: today } });
      })
      .catch(() => {});
  }, [
    gameState.checkin.streak,
    learningState.wrongRecords.length,
    stats,
    userDispatch,
    userState.dailyEncouragementDate,
  ]);

  const handleCloseGuide = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
    setIsGuideOpen(false);
  };

  useEffect(() => {
    let cancelled = false;
    getAvailableKnowledgeBases()
      .then(items => {
        if (!cancelled) setKnowledgeBases(items);
      })
      .catch(error => {
        console.error('[Home] failed to load recommended knowledge packages', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openPrimaryLearning = useCallback(() => {
    navigate('flashcard-learning');
  }, [navigate]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const userName = userState.user?.nickname?.trim() || '同学';
  const dailyGoal = Math.max(1, userState.user?.dailyGoal ?? 10);
  const todayLearningCount = getTodayLearningProgress(learningState).totalCount;
  const dailyGoalCompleted = todayLearningCount >= dailyGoal;
  const dailyGoalPercent = clampPercent((todayLearningCount / dailyGoal) * 100);
  const reviewPending = learningState.todayReviewItems.filter(item => !item.completed).length;
  const completedReview = learningState.todayReviewItems.length - reviewPending;
  const totalReviewTasks = learningState.todayReviewItems.length;
  const completedNew = learningState.todayNewItems.filter(item => item.completed).length;
  const remainingGoalCount = Math.max(dailyGoal - todayLearningCount, 0);
  const hasCheckedInToday = gameState.checkin.records.some(record => record.date === todayKey);
  const encouragementText = userState.dailyEncouragement ?? fallbackEncouragement;
  const isScholar = theme.uiStyle === 'scholar' || theme.isFluidScholar;
  const isDark = isDarkTheme(theme);
  const classicPalette = isDark
    ? {
        ...paperPalette,
        bg: theme.bg,
        ink: theme.textPrimary,
        muted: theme.textSecondary,
        faint: theme.textMuted,
        card: theme.bgCard,
        line: theme.border,
        greenSoft: theme.surfaceContainerHigh || theme.bgCard,
        amberSoft: theme.secondaryFixed || theme.surfaceContainerHigh || theme.bgCard,
        roseSoft: theme.surfaceContainerHigh || theme.bgCard,
        blueSoft: theme.primaryFixed || theme.surfaceContainerHigh || theme.bgCard,
      }
    : paperPalette;
  const masteryCount = stats.masteredCount + stats.normalCount;
  const recommendedPackages = useMemo(
    () => getRecommendedPackages(knowledgeBases, selectedDirection),
    [knowledgeBases, selectedDirection],
  );
  const firstRecommendedPackage = recommendedPackages[0] ?? knowledgeBases[0] ?? null;

  useEffect(() => {
    return scheduleReviewReminder(reviewPending) ?? undefined;
  }, [reviewPending, reminderEnabled]);

  const claimKnowledgePackage = useCallback(async (subjectId: string) => {
    if (claimingPackageId) return;
    setClaimingPackageId(subjectId);
    setContentPackageError(null);
    try {
      const packageInfo = knowledgeBases.find(item => item.id === subjectId);
      const downloaded = await downloadKnowledgeFromOSS(subjectId);
      if (!downloaded || downloaded.knowledgePoints.length === 0) {
        throw new Error('内容包下载失败');
      }
      const now = new Date().toISOString();
      learningDispatch({
        type: 'SET_KNOWLEDGE_DATA',
        payload: {
          subjects: [{
            id: subjectId,
            name: packageInfo?.name || subjectId,
            icon: packageInfo?.icon || '📚',
            color: packageInfo?.color || theme.primary,
            knowledgePointCount: downloaded.knowledgePoints.length,
          }],
          chapters: downloaded.chapters,
          knowledgePoints: downloaded.knowledgePoints,
          questions: downloaded.questions,
          importHistory: {
            source: 'local',
            sourceId: subjectId,
            label: packageInfo?.name || subjectId,
            createdAt: now,
          },
        },
      });
      learningDispatch({
        type: 'SET_IMPORTED_STUDY_SESSION',
        payload: {
          id: `content-package-${subjectId}-${Date.now()}`,
          source: 'import',
          knowledgePointIds: downloaded.knowledgePoints.map(kp => kp.id),
          subjectId,
          chapterId: downloaded.chapters[0]?.id || downloaded.knowledgePoints[0]?.chapterId || subjectId,
          importedKnowledgeCount: downloaded.knowledgePoints.length,
          importedQuestionCount: downloaded.questions.length,
          skippedQuestionCount: 0,
          createdAt: now,
        },
      });
      navigate('flashcard-learning');
    } catch (error) {
      setContentPackageError(error instanceof Error ? error.message : '内容包领取失败');
    } finally {
      setClaimingPackageId(null);
    }
  }, [claimingPackageId, knowledgeBases, learningDispatch, navigate, theme.primary]);

  const enableReminder = useCallback(async () => {
    const granted = await requestReviewReminderPermission();
    setReminderEnabled(granted || getReviewReminderSettings().enabled);
  }, []);

  const setStudyDirectionProfile = useCallback((direction: StudyDirection) => {
    const learningProfile = normalizeLearningProfile({
      ...userState.user?.learningProfile,
      studyDirection: direction,
      updatedAt: new Date().toISOString(),
    });
    userDispatch({ type: 'UPDATE_USER', payload: { learningProfile } });
    accountUpdateProfile({ learningProfile }).catch(error => {
      console.warn('Failed to sync study direction:', error);
    });
  }, [userDispatch, userState.user?.learningProfile]);

  const syncChip = (
    <button
      onClick={retryLearningSync}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold"
      style={{
        borderColor: syncStatus.state === 'failed' ? '#fecaca' : theme.border,
        backgroundColor: syncStatus.state === 'failed' ? '#fef2f2' : theme.bgCard,
        color: syncStatus.state === 'failed' ? '#dc2626' : theme.textSecondary,
      }}
      aria-label="同步状态，点击重试"
    >
      {syncStatus.state === 'syncing' ? <RefreshCw size={13} className="animate-spin" /> : <Cloud size={13} />}
      {syncStatus.message}
    </button>
  );

  const contentPackagePanel = firstRecommendedPackage ? (
    <section
      className="mt-5 rounded-lg border p-4"
      style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[16px] font-extrabold" style={{ color: theme.textPrimary }}>开始学习推荐内容</h3>
          <p className="mt-1 text-xs leading-5" style={{ color: theme.textSecondary }}>
            选择方向，一键加入内容包，直接开始第一张卡。
          </p>
        </div>
        <button
          onClick={() => claimKnowledgePackage(firstRecommendedPackage.id)}
          disabled={Boolean(claimingPackageId)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
          style={{ backgroundColor: theme.primary }}
        >
          {claimingPackageId ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
          领取
        </button>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STUDY_DIRECTIONS.map(direction => (
          <button
            key={direction.id}
            onClick={() => setSelectedDirection(direction.id)}
            className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold"
            style={{
              borderColor: selectedDirection === direction.id ? theme.primary : theme.border,
              backgroundColor: selectedDirection === direction.id ? `${theme.primary}12` : theme.bg,
              color: selectedDirection === direction.id ? theme.primary : theme.textSecondary,
            }}
          >
            {direction.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2">
        {recommendedPackages.slice(0, 2).map(item => (
          <button
            key={item.id}
            onClick={() => claimKnowledgePackage(item.id)}
            disabled={Boolean(claimingPackageId)}
            className="flex items-center justify-between rounded-lg border px-3 py-3 text-left disabled:opacity-60"
            style={{ borderColor: theme.border, backgroundColor: theme.bg }}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold" style={{ color: theme.textPrimary }}>
                {item.icon || '📚'} {item.name}
              </span>
              <span className="mt-0.5 block text-xs" style={{ color: theme.textMuted }}>
                {item.kpCount ?? 0} 张卡 · {item.qCount ?? 0} 道题
              </span>
            </span>
            <ChevronRight size={16} style={{ color: theme.textMuted }} />
          </button>
        ))}
      </div>
      {contentPackageError && (
        <p className="mt-2 text-xs text-red-600">{contentPackageError}</p>
      )}
    </section>
  ) : null;

  const reminderPanel = !reminderEnabled && reviewPending > 0 ? (
    <section
      className="mt-5 flex items-center gap-3 rounded-lg border p-4"
      style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
        <Bell size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold" style={{ color: theme.textPrimary }}>开启复习提醒</p>
        <p className="mt-0.5 text-xs" style={{ color: theme.textSecondary }}>浏览器会在晚上提醒你清掉到期卡片。</p>
      </div>
      <button
        onClick={enableReminder}
        className="shrink-0 rounded-lg px-3 py-2 text-xs font-bold text-white"
        style={{ backgroundColor: theme.primary }}
      >
        开启
      </button>
    </section>
  ) : null;

  const headline = useMemo(() => {
    if (reviewPending > 0) return `先复习 ${reviewPending} 张到期卡片`;
    if (remainingGoalCount > 0) return `再完成 ${remainingGoalCount} 项学习量`;
    if (!hasCheckedInToday) return '目标完成了，顺手签到';
    return '今天的节奏已经稳住了';
  }, [hasCheckedInToday, remainingGoalCount, reviewPending]);

  const isColdStart = todayLearningCount === 0 && masteryCount === 0;
  const heroPackage = isColdStart ? firstRecommendedPackage : null;
  const heroTitle = reviewPending > 0
    ? `复习 ${reviewPending} 张到期卡`
    : heroPackage
      ? `从「${heroPackage.name}」开始`
      : '开始今天的学习';
  const heroDescription = reviewPending > 0
    ? '先清掉到期复习，避免记忆曲线断档。'
    : heroPackage
      ? '一键加入推荐内容包，马上进入第一张卡。'
      : '从上次停下的地方接着来，完成后给自己一点休息。';

  const mainActionLabel = reviewPending > 0
    ? '继续复习'
    : heroPackage
      ? '领取并开始'
    : remainingGoalCount > 0
      ? '开始学习'
      : hasCheckedInToday
        ? '再练一组'
        : '去签到';

  const mainAction = heroPackage
    ? () => claimKnowledgePackage(heroPackage.id)
    : (hasCheckedInToday || reviewPending > 0 || remainingGoalCount > 0)
      ? openPrimaryLearning
      : () => navigate('checkin');

  const statusCards = [
    {
      key: 'review',
      label: '待复习',
      value: reviewPending,
      hint: totalReviewTasks > 0 ? `已完成 ${completedReview}/${totalReviewTasks}` : '暂无到期卡片',
      color: paperPalette.amber,
      bg: classicPalette.amberSoft,
      onClick: openPrimaryLearning,
    },
    {
      key: 'done',
      label: '已完成',
      value: Math.min(todayLearningCount, dailyGoal),
      hint: `今日目标 ${dailyGoal}`,
      color: paperPalette.green,
      bg: classicPalette.greenSoft,
      onClick: openPrimaryLearning,
    },
    {
      key: 'checkin',
      label: hasCheckedInToday ? '已签到' : '可签到',
      value: hasCheckedInToday ? '✓' : gameState.checkin.streak,
      hint: hasCheckedInToday ? '节奏保持中' : `连学 ${gameState.checkin.streak} 天`,
      color: paperPalette.rose,
      bg: classicPalette.roseSoft,
      onClick: () => navigate('checkin'),
    },
  ];

  const routeItems = [
    {
      key: 'review',
      title: '今日复习',
      desc: reviewPending > 0 ? '先清空到期卡片' : '复习任务已完成',
      ratio: totalReviewTasks > 0 ? completedReview / totalReviewTasks : 1,
      icon: BookOpen,
    },
    {
      key: 'goal',
      title: '今日目标',
      desc: remainingGoalCount > 0 ? `还差 ${remainingGoalCount} 项学习量` : '目标已经完成',
      ratio: Math.min(1, todayLearningCount / dailyGoal),
      icon: Target,
    },
  ];

  const profData: { level: ProficiencyLevel; count: number }[] = [
    { level: 'master', count: stats.masteredCount },
    { level: 'normal', count: stats.normalCount },
    { level: 'rusty', count: stats.rustyCount },
    { level: 'none', count: stats.noneCount },
  ];

  const homeFabMenuItems = useMemo(() => [
    {
      id: 'checkin',
      label: '签到',
      icon: CalendarCheck,
      onSelect: () => navigate('checkin'),
      accentColor: '#7fb069',
      backgroundColor: theme.bgCard,
    },
    {
      id: 'team',
      label: '小队',
      icon: Users,
      onSelect: () => navigate('team'),
      accentColor: '#4f46e5',
      backgroundColor: theme.bgCard,
    },
    {
      id: 'achievements',
      label: '成就',
      icon: Trophy,
      onSelect: () => navigate('achievements'),
      accentColor: '#d99536',
      backgroundColor: theme.bgCard,
    },
    {
      id: 'shop',
      label: '商店',
      icon: ShoppingBag,
      onSelect: () => navigate('shop'),
      accentColor: '#c58b84',
      backgroundColor: theme.bgCard,
    },
    {
      id: 'ranking',
      label: '排名',
      icon: Medal,
      onSelect: () => navigate('ranking'),
      accentColor: '#87a8a4',
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

  const bottomNav = <TabBar placement="contained" />;
  const floatingPanel = (
    <FloatingAIPanel
      menuItems={homeFabMenuItems}
      placement="contained"
      ownerPage="home"
      primaryIcon={Sparkles}
      primaryTitle="开始学习"
      onPrimaryAction={openPrimaryLearning}
    />
  );
  if (isScholar) {
    const accentPrimary = theme.primary || '#24389c';
    const accentSurface = theme.onSurface || '#191c1d';
    const rawGreeting = getGreeting();
    const scholarGreeting = `${rawGreeting.split('，')[0]}，继续加油`;
    const scholarHeadline = (() => {
      if (reviewPending > 0 && completedNew === 0) return `先清掉 ${reviewPending} 张复习卡`;
      if (reviewPending > 0) return `还有 ${reviewPending} 张卡待复习`;
      if (!dailyGoalCompleted) return `再完成 ${remainingGoalCount} 项学习量`;
      if (hasCheckedInToday) return '保持节奏，继续前进';
      return '今日目标全部完成';
    })();

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
        key: 'review',
        name: '完成今日复习',
        detail: reviewPending > 0 ? '优先清空待复习卡片' : '今日复习已完成',
        progress: `${completedReview}/${totalReviewTasks}`,
        ratio: totalReviewTasks > 0 ? completedReview / totalReviewTasks : 1,
        onClick: openPrimaryLearning,
        icon: Brain,
        accent: '#6366f1',
        softBg: 'rgba(99, 102, 241, 0.1)',
      },
      {
        key: 'new-learning',
        name: '完成今日目标',
        detail: dailyGoalCompleted ? '今日学习目标已完成' : `还差 ${remainingGoalCount} 项学习量`,
        progress: `${Math.min(todayLearningCount, dailyGoal)}/${dailyGoal}`,
        ratio: Math.min(1, todayLearningCount / dailyGoal),
        onClick: openPrimaryLearning,
        icon: TrendingUp,
        accent: '#f59e0b',
        softBg: 'rgba(245, 158, 11, 0.12)',
      },
      {
        key: 'checkin',
        name: '保持签到节奏',
        detail: hasCheckedInToday ? '今天已经签到，继续保持' : '完成签到，点亮今日状态',
        progress: hasCheckedInToday ? '1/1' : '0/1',
        ratio: hasCheckedInToday ? 1 : 0,
        onClick: () => navigate('checkin'),
        icon: CalendarCheck,
        accent: '#10b981',
        softBg: 'rgba(16, 185, 129, 0.12)',
      },
    ];

    return (
      <div
        className="relative flex h-full max-w-[430px] flex-col overflow-hidden"
        style={getAdaptivePageBackground(theme)}
      >
        <main className="h-full overflow-y-auto px-6 pb-[132px] pt-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
            <div className="flex shrink-0 items-center gap-2">
              {syncChip}
              <button
                onClick={() => navigate('settings')}
                className="flex h-11 w-11 items-center justify-center rounded-full border shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition-transform duration-200 active:scale-[0.97]"
                style={{ borderColor: theme.border, backgroundColor: theme.bgCard, color: theme.textSecondary }}
                aria-label="设置"
              >
                <Settings size={18} />
              </button>
            </div>
          </header>

          <section className="mb-7 w-full">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-medium" style={{ color: theme.textSecondary }}>
                {scholarGreeting}
              </p>
              {stats.streakDays > 0 && (
                <div
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
                  style={{
                    backgroundColor: `${theme.secondaryFixed || '#ffdfa0'}cc`,
                    color: theme.onSecondaryFixedVariant || '#5c4300',
                  }}
                >
                  {stats.streakDays} 天
                </div>
              )}
            </div>
            <h1
              className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight"
              style={{ color: theme.textPrimary, fontFamily: 'Plus Jakarta Sans, Noto Sans SC, sans-serif' }}
            >
              {scholarHeadline}
            </h1>
          </section>

          <section className="mb-7 grid w-full grid-cols-2 gap-4">
            {scholarStatsCards.map(card => {
              const Icon = card.icon;
              return (
                <article
                  key={card.key}
                  className="relative min-h-[136px] overflow-hidden rounded-[var(--radius-xl)] p-5 shadow-[0_4px_16px_rgba(15,23,42,0.10)]"
                  style={{ backgroundColor: theme.bgCard, border: `1.5px solid ${theme.border}` }}
                >
                  <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl" style={{ background: card.glow }} />
                  <div className="relative flex h-full flex-col">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: card.chipBg, color: card.accent }}>
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

          {contentPackagePanel}
          {reminderPanel}

          <section className="mt-7 w-full">
            <div className="mb-4 flex items-center justify-between pr-20">
              <h3
                className="text-xl font-extrabold tracking-tight"
                style={{ color: theme.textPrimary, fontFamily: 'Plus Jakarta Sans, Noto Sans SC, sans-serif' }}
              >
                今日任务
              </h3>
              <button onClick={openPrimaryLearning} className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: theme.primary }}>
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
        </main>

        {isActive && (
          <div className="absolute bottom-0 left-0 right-0 z-40">
            {bottomNav}
          </div>
        )}
        {isActive && (
          <div className="absolute bottom-[82px] right-6 z-50">
            {floatingPanel}
          </div>
        )}
        <OnboardingGuide
          open={isGuideOpen}
          onClose={handleCloseGuide}
          onClaimPackage={claimKnowledgePackage}
          onEnableReminder={enableReminder}
          onSetDailyGoal={goal => userDispatch({ type: 'SET_DAILY_GOAL', payload: goal })}
          onSetStudyDirection={setStudyDirectionProfile}
          recommendedPackage={firstRecommendedPackage}
          isClaimingPackage={Boolean(claimingPackageId)}
        />
      </div>
    );
  }

  return (
    <div
      className="relative h-full overflow-hidden"
      style={{
        ...getAdaptivePageBackground(theme),
        background: isScholar
          ? `linear-gradient(180deg, ${theme.bg} 0%, ${theme.surfaceContainerLow || theme.bg} 100%)`
          : classicPalette.bg,
        color: isScholar ? theme.textPrimary : classicPalette.ink,
      }}
    >
      {!isScholar && !isDark && <PaperTexture />}

      <main className="absolute inset-x-0 top-0 bottom-[56px] overflow-y-auto px-[18px] pb-32 pt-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] leading-5" style={{ color: isScholar ? theme.textSecondary : classicPalette.muted }}>
              {getGreeting()}，{userName}
            </p>
            <h1 className="mt-1 text-[25px] font-extrabold leading-[1.2]" style={{ color: isScholar ? theme.textPrimary : classicPalette.ink }}>
              {headline}
            </h1>
            <p className="mt-2 max-w-[260px] text-[13px] leading-5" style={{ color: isScholar ? theme.textSecondary : classicPalette.muted }}>
              先完成一件小事，也算前进。今天不用急，把节奏接住就好。
            </p>
          </div>
          <button
            onClick={() => navigate('settings')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-transform active:scale-[0.97]"
            style={{ ...getAdaptiveButton(theme, 'ghost'), borderColor: isScholar ? theme.border : classicPalette.line, color: isScholar ? theme.textSecondary : classicPalette.muted }}
            aria-label="设置"
          >
            <Settings size={18} />
          </button>
        </header>

        <div className="mt-4 flex justify-end">
          {syncChip}
        </div>

        <section
          className="relative mt-5 overflow-hidden rounded-lg border p-5 shadow-[0_14px_34px_-28px_rgba(97,71,38,0.7)]"
          style={{
            backgroundColor: isScholar ? theme.bgCard : classicPalette.card,
            borderColor: isScholar ? theme.border : classicPalette.line,
          }}
        >
          {!isScholar && (
            <>
              <div className="absolute left-6 top-[-8px] h-5 w-20 rotate-[-4deg] rounded bg-slate-200/55" />
              <div className="absolute right-9 top-[-7px] h-5 w-16 rotate-[5deg] rounded bg-slate-200/50" />
              <div className="absolute right-[-24px] top-5 h-28 w-28 rounded-full bg-[#eef7ed]" />
              <div className="absolute left-[-28px] bottom-8 h-24 w-24 rounded-full bg-[#f3f6f8]" />
            </>
          )}

          <div className="relative">
            <div
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold"
              style={{
                backgroundColor: isScholar ? theme.surfaceContainerLow || '#f3f4f5' : classicPalette.greenSoft,
                borderColor: isScholar ? theme.border : '#c8dfac',
                color: isScholar ? theme.textSecondary : '#4e7a3f',
              }}
            >
              <Leaf size={13} />
              今日重点
            </div>

            <h2 className="mt-4 text-[24px] font-extrabold leading-[1.2]" style={{ color: isScholar ? theme.textPrimary : classicPalette.ink }}>
              {heroTitle}
            </h2>
            <p className="mt-2 text-[13px] leading-5" style={{ color: isScholar ? theme.textSecondary : classicPalette.muted }}>
              {heroDescription}
            </p>

            <div className="mt-5 max-w-[210px]">
              <div className="flex items-center justify-between text-[12px] font-semibold" style={{ color: isScholar ? theme.textSecondary : classicPalette.muted }}>
                <span>今日目标</span>
                <span>{Math.min(todayLearningCount, dailyGoal)}/{dailyGoal}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: isScholar ? theme.surfaceContainerHigh || '#e7e8e9' : '#e9ddce' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${dailyGoalPercent}%`,
                    backgroundColor: isScholar ? theme.primary : paperPalette.green,
                  }}
                />
              </div>
            </div>

            <button
              onClick={mainAction}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold text-white shadow-[0_12px_22px_-16px_rgba(79,122,63,0.9)] transition-transform active:scale-[0.98]"
              style={{ backgroundColor: isScholar ? theme.primary : paperPalette.green }}
            >
              <Play size={15} fill="currentColor" />
              {mainActionLabel}
            </button>
          </div>
        </section>

        {contentPackagePanel}
        {reminderPanel}

        <section className="mt-4 grid grid-cols-3 gap-2.5">
          {statusCards.map(card => (
            <button
              key={card.key}
              onClick={card.onClick}
              className="min-h-[88px] rounded-lg border p-3 text-left shadow-[0_10px_26px_-22px_rgba(97,71,38,0.65)] transition-transform active:scale-[0.98]"
              style={{
                backgroundColor: isScholar ? theme.bgCard : classicPalette.card,
                borderColor: isScholar ? theme.border : classicPalette.line,
              }}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: card.bg, color: card.color }}>
                <Circle size={10} fill="currentColor" />
              </span>
              <div className="mt-2 text-[22px] font-extrabold leading-none" style={{ color: isScholar ? theme.textPrimary : classicPalette.ink }}>
                {card.value}
              </div>
              <div className="mt-1 text-[12px] font-bold" style={{ color: isScholar ? theme.textPrimary : classicPalette.ink }}>
                {card.label}
              </div>
              <div className="mt-0.5 text-[10px] leading-4" style={{ color: isScholar ? theme.textMuted : classicPalette.faint }}>
                {card.hint}
              </div>
            </button>
          ))}
        </section>

        <section
          className="mt-5 rounded-lg border p-5 shadow-[0_12px_30px_-24px_rgba(97,71,38,0.65)]"
          style={{ backgroundColor: isScholar ? theme.bgCard : classicPalette.card, borderColor: isScholar ? theme.border : classicPalette.line }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[18px] font-extrabold" style={{ color: isScholar ? theme.textPrimary : classicPalette.ink }}>
                学习路线
              </h3>
              <p className="mt-1 text-[12px]" style={{ color: isScholar ? theme.textSecondary : classicPalette.muted }}>
                先复习，再推进今天的目标
              </p>
            </div>
            <span
              className="rounded-full px-3 py-1 text-[12px] font-semibold"
              style={{
                backgroundColor: isScholar ? theme.surfaceContainerLow || '#f3f4f5' : classicPalette.amberSoft,
                color: isScholar ? theme.textSecondary : '#8a6128',
              }}
            >
              进行中
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {routeItems.map(item => {
              const Icon = item.icon;
              const percent = clampPercent(item.ratio * 100);
              return (
                <button key={item.key} onClick={openPrimaryLearning} className="flex w-full items-center gap-3 text-left">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: isScholar ? theme.surfaceContainerLow || '#f3f4f5' : classicPalette.greenSoft, color: isScholar ? theme.primary : paperPalette.green }}
                  >
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold" style={{ color: isScholar ? theme.textPrimary : classicPalette.ink }}>
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-[12px]" style={{ color: isScholar ? theme.textSecondary : classicPalette.muted }}>
                      {item.desc}
                    </span>
                  </span>
                  <span className="h-2 w-[74px] overflow-hidden rounded-full" style={{ backgroundColor: isScholar ? theme.surfaceContainerHigh || '#e7e8e9' : '#e9ddce' }}>
                    <span
                      className="block h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%`, backgroundColor: isScholar ? theme.primary : paperPalette.green }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section
          className="mt-5 rounded-lg border p-5 shadow-[0_12px_30px_-24px_rgba(97,71,38,0.65)]"
          style={{ backgroundColor: isScholar ? theme.bgCard : classicPalette.card, borderColor: isScholar ? theme.border : classicPalette.line }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[18px] font-extrabold" style={{ color: isScholar ? theme.textPrimary : classicPalette.ink }}>
                掌握花园
              </h3>
              <p className="mt-1 text-[12px] leading-5" style={{ color: isScholar ? theme.textSecondary : classicPalette.muted }}>
                这些知识点已经慢慢长起来了。
              </p>
            </div>
            <button
              onClick={() => navigate('knowledge-map')}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold"
              style={{ borderColor: isScholar ? theme.border : classicPalette.line, color: isScholar ? theme.primary : paperPalette.green }}
            >
              查看
              <ChevronRight size={13} />
            </button>
          </div>

          <div className="mt-5 flex h-3 overflow-hidden rounded-full" style={{ backgroundColor: isScholar ? theme.surfaceContainerHigh || '#e7e8e9' : '#e9ddce' }}>
            {profData.map(item => {
              const pct = stats.totalKnowledgePoints > 0 ? (item.count / stats.totalKnowledgePoints) * 100 : 0;
              if (pct <= 0) return null;
              return (
                <span
                  key={item.level}
                  className="h-full"
                  style={{ width: `${pct}%`, backgroundColor: PROFICIENCY_MAP[item.level].color }}
                />
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {profData.map(item => (
              <div key={item.level}>
                <div className="text-[16px] font-extrabold" style={{ color: PROFICIENCY_MAP[item.level].color }}>
                  {item.count}
                </div>
                <div className="mt-1 text-[10px]" style={{ color: isScholar ? theme.textMuted : classicPalette.faint }}>
                  {PROFICIENCY_MAP[item.level].label}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          className="mt-5 rounded-lg border p-4"
          style={{
            backgroundColor: isScholar ? theme.bgCard : classicPalette.card,
            borderColor: isScholar ? theme.border : classicPalette.line,
          }}
        >
          <div className="flex items-start gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: isScholar ? theme.surfaceContainerLow || '#f3f4f5' : classicPalette.blueSoft, color: isScholar ? theme.primary : paperPalette.blue }}
            >
              <Bot size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] font-bold" style={{ color: isScholar ? theme.textPrimary : classicPalette.ink }}>
                AI 学习助手
              </h3>
              <p className="mt-1 line-clamp-2 text-[12px] leading-5" style={{ color: isScholar ? theme.textSecondary : classicPalette.muted }}>
                {encouragementText}
              </p>
            </div>
            <button
              onClick={() => navigate('ai-chat')}
              className="inline-flex h-8 shrink-0 items-center rounded-lg px-3 text-[12px] font-bold text-white"
              style={{ backgroundColor: isScholar ? theme.primary : paperPalette.blue }}
            >
              询问
            </button>
          </div>
        </section>

        {stats.weakSubjects.length > 0 && (
          <section
            className="mt-5 rounded-lg border p-4"
            style={{
              backgroundColor: isScholar ? theme.bgCard : classicPalette.card,
              borderColor: isScholar ? theme.border : '#edd2c7',
            }}
          >
            <div className="flex items-center gap-2 text-[14px] font-bold" style={{ color: isScholar ? theme.textPrimary : '#7a4439' }}>
              <PenLine size={16} />
              需要多看一眼
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {stats.weakSubjects.map(subject => (
                <span key={subject} className="rounded-full px-3 py-1 text-[12px] font-semibold" style={{ backgroundColor: '#f8e6df', color: '#7a4439' }}>
                  {subject}
                </span>
              ))}
            </div>
          </section>
        )}
      </main>

      {isActive && (
        <div className="absolute inset-x-0 bottom-0 z-40">
          {bottomNav}
        </div>
      )}
      {isActive && (
        <div className="absolute bottom-[70px] right-5 z-[80]">
          {floatingPanel}
        </div>
      )}
      <OnboardingGuide
        open={isGuideOpen}
        onClose={handleCloseGuide}
        onClaimPackage={claimKnowledgePackage}
        onEnableReminder={enableReminder}
        onSetDailyGoal={goal => userDispatch({ type: 'SET_DAILY_GOAL', payload: goal })}
        onSetStudyDirection={setStudyDirectionProfile}
        recommendedPackage={firstRecommendedPackage}
        isClaimingPackage={Boolean(claimingPackageId)}
      />
    </div>
  );
}

function PaperTexture() {
  const dots = useMemo(() => {
    const items = [];
    for (let x = 8; x <= 386; x += 18) {
      for (let y = 8; y <= 836; y += 18) {
        items.push(`${x}-${y}`);
      }
    }
    return items;
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-16 -top-12 h-56 w-56 rounded-full bg-slate-100/70 blur-3xl" />
      <div className="absolute -right-10 top-12 h-48 w-48 rounded-full bg-[#eef7ed]/65 blur-3xl" />
      <div className="absolute bottom-4 right-[-70px] h-56 w-56 rounded-full bg-slate-100/60 blur-3xl" />
      <div className="absolute inset-0 opacity-35">
        {dots.map(key => {
          const [x, y] = key.split('-');
          return (
            <span
              key={key}
              className="absolute h-0.5 w-0.5 rounded-full bg-slate-300"
              style={{ left: Number(x), top: Number(y) }}
            />
          );
        })}
      </div>
      <CheckCircle2 className="absolute right-8 top-[118px] text-[#d99536]/20" size={54} strokeWidth={1.2} />
    </div>
  );
}
