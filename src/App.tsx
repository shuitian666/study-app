import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Brain,
  ChevronRight,
  Home,
  Map,
  MessageCircle,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PenTool,
  Settings,
  Sparkles,
  Trophy,
  User,
  X,
} from 'lucide-react';
import TabBar from '@/components/layout/TabBar';
import AchievementPopup from '@/components/ui/AchievementPopup';
import LevelUpCelebration from '@/components/ui/LevelUpCelebration';
import LotteryDrawModal from '@/components/ui/LotteryDrawModal';
import { ThemeStyles } from '@/components/ui/ThemeStyles';
import { allBackgrounds } from '@/data/avatarCatalog';
import { accountClaimLevelReward, fetchMe } from '@/services/aiClient';
import { applyServerAccountPayload, logoutOnUnauthorized } from '@/store/accountSync';
import { useGame } from '@/store/GameContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { useUser } from '@/store/UserContext';
import { isDarkTheme } from '@/utils/adaptiveTheme';
import { calculateLearningExperience } from '@/utils/achievementProgress';
import { calculateLevelProgress } from '@/utils/experience';
import {
  detectLevelUpTransition,
  STUDY_EXPERIENCE_EVENT,
  type LevelUpTransition,
} from '@/utils/levelRewards';
import type { AIStudyTutorContext } from '@/types';

const LoginPage = React.lazy(() => import('@/pages/Login'));
const HomePage = React.lazy(() => import('@/pages/Home'));
const ProfilePage = React.lazy(() => import('@/pages/Profile'));
const KnowledgePage = React.lazy(() => import('@/pages/Knowledge'));
const KnowledgeDetailPage = React.lazy(() => import('@/pages/Knowledge/KnowledgeDetail'));
const AddKnowledgePage = React.lazy(() => import('@/pages/Knowledge/AddKnowledge'));
const ImportKnowledgePage = React.lazy(() => import('@/pages/Knowledge/ImportKnowledge'));
const QuizPage = React.lazy(() => import('@/pages/Quiz'));
const QuizSessionPage = React.lazy(() => import('@/pages/Quiz/QuizSession'));
const QuizResultPage = React.lazy(() => import('@/pages/Quiz/QuizResult'));
const WrongBookPage = React.lazy(() => import('@/pages/Quiz/WrongBook'));
const KnowledgeMapPage = React.lazy(() => import('@/pages/KnowledgeMap'));
const CheckinPage = React.lazy(() => import('@/features/gamification/checkin'));
const TeamPage = React.lazy(() => import('@/features/gamification/team'));
const AchievementsPage = React.lazy(() => import('@/features/gamification/achievements'));
const ShopPage = React.lazy(() => import('@/features/gamification/shop'));
const RankingPage = React.lazy(() => import('@/features/gamification/ranking'));
const LotteryPage = React.lazy(() => import('@/features/gamification/lottery'));
const AIChatPage = React.lazy(() => import('@/pages/AIChat'));
const AIStudyPage = React.lazy(() => import('@/pages/AIStudy'));
const StudyTutorPanel = React.lazy(() => import('@/components/ai/StudyTutorPanel'));
const AIStudySummariesPage = React.lazy(() => import('@/pages/AIStudy/Summaries'));
const TruthAdminPage = React.lazy(() => import('@/pages/TruthAdmin'));
const AdminPage = React.lazy(() => import('@/pages/Admin'));
const SettingsPage = React.lazy(() => import('@/pages/Settings'));
const InventoryPage = React.lazy(() => import('@/features/gamification/inventory'));
const MailPage = React.lazy(() => import('@/features/gamification/mail'));
const AvatarEditPage = React.lazy(() => import('@/pages/AvatarEdit'));
const FlashcardLearningPage = React.lazy(() => import('@/pages/FlashcardLearning'));

type StarParticle = {
  left: number;
  top: number;
  animationDelay: number;
  opacity: number;
};

type CherryParticle = {
  left: number;
  top: number;
  animationDelay: number;
};

type MainTab = 'home' | 'knowledge' | 'quiz' | 'knowledge-map' | 'profile';
type DesktopSidebarState = 'collapsed' | 'overview' | 'ai';

function particleValue(seed: number, min = 0, max = 1) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return min + (value - Math.floor(value)) * (max - min);
}

const LoadingFallback = () => (
  <div className="flex min-h-screen flex-col" style={{ backgroundColor: 'var(--color-bg-var)' }}>
    <div className="flex-1 space-y-4 p-6">
      <div className="h-6 w-2/3 animate-pulse rounded-2xl" style={{ backgroundColor: 'var(--color-surface-container-high-var)' }} />
      <div className="h-4 w-1/2 animate-pulse rounded-2xl" style={{ backgroundColor: 'var(--color-surface-container-high-var)' }} />
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="h-32 animate-pulse rounded-[var(--radius-xl)]" style={{ backgroundColor: 'var(--color-surface-container-low-var)' }} />
        <div className="h-32 animate-pulse rounded-[var(--radius-xl)]" style={{ backgroundColor: 'var(--color-surface-container-low-var)' }} />
      </div>
      <div className="mt-2 h-40 animate-pulse rounded-[var(--radius-xl)]" style={{ backgroundColor: 'var(--color-surface-container-low-var)' }} />
    </div>
    <div className="h-[82px] w-full" style={{ backgroundColor: 'var(--color-surface-container-lowest-var)' }} />
  </div>
);

function AppContent() {
  const { userState, userDispatch, navigate } = useUser();
  const { gameState, gameDispatch } = useGame();
  const { learningState } = useLearning();
  const { theme } = useTheme();
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const [isDesktopNavExpanded, setIsDesktopNavExpanded] = useState(false);
  const [desktopSidebarState, setDesktopSidebarState] = useState<DesktopSidebarState>('collapsed');
  const [isDesktopAiMounted, setIsDesktopAiMounted] = useState(false);
  const [desktopAiMode, setDesktopAiMode] = useState<'chat' | 'tutor'>('chat');
  const [desktopQuestionContext, setDesktopQuestionContext] = useState<{ id: string; text: string } | null>(null);
  const [desktopTutorContext, setDesktopTutorContext] = useState<AIStudyTutorContext | null>(null);
  const [levelUpState, setLevelUpState] = useState<(LevelUpTransition & {
    userId: string;
    claimingReward: boolean;
    rewardClaimed: boolean;
    rewardError: string;
  }) | null>(null);
  const desktopQuestionSequenceRef = useRef(0);
  const phoneScrollRef = useRef<HTMLDivElement>(null);
  const desktopContentRef = useRef<HTMLDivElement>(null);
  const desktopNavToggleRef = useRef<HTMLButtonElement>(null);
  const desktopToolsToggleRef = useRef<HTMLButtonElement>(null);
  const previousExperienceTotalRef = useRef<number | null>(null);
  const studyEventExpiresAtRef = useRef(0);
  const claimedRewardLevelsRef = useRef(new Set<number>());
  const isDark = isDarkTheme(theme);
  const isLargeScreen = viewportWidth > 768;
  const isWideDesktop = viewportWidth >= 1360;

  const openDesktopAI = useCallback((questionContext?: string) => {
    setIsDesktopNavExpanded(false);
    setIsDesktopAiMounted(true);
    setDesktopAiMode('chat');
    setDesktopSidebarState('ai');
    if (questionContext?.trim()) {
      desktopQuestionSequenceRef.current += 1;
      setDesktopQuestionContext({
        id: `desktop-question-${Date.now()}-${desktopQuestionSequenceRef.current}`,
        text: questionContext.trim(),
      });
    }
  }, []);

  const openDesktopTutor = useCallback((context: AIStudyTutorContext) => {
    setIsDesktopNavExpanded(false);
    setIsDesktopAiMounted(true);
    setDesktopTutorContext(context);
    setDesktopAiMode('tutor');
    setDesktopSidebarState('ai');
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then(payload => {
        if (cancelled) return;
        if (!payload) {
          if (userState.isLoggedIn) {
            userDispatch({ type: 'LOGOUT' });
          }
          return;
        }
        applyServerAccountPayload(payload, userDispatch, gameDispatch);
      })
      .catch(err => {
        logoutOnUnauthorized(err, userDispatch);
      });
    return () => {
      cancelled = true;
    };
  }, [gameDispatch, userDispatch, userState.isLoggedIn]);

  useEffect(() => {
    const handleStudyExperience = () => {
      studyEventExpiresAtRef.current = Date.now() + 5000;
    };
    window.addEventListener(STUDY_EXPERIENCE_EVENT, handleStudyExperience);
    return () => window.removeEventListener(STUDY_EXPERIENCE_EVENT, handleStudyExperience);
  }, []);

  const currentBackground = useMemo(() => {
    const backgroundId = userState.user?.background;
    if (!backgroundId) return 'linear-gradient(180deg, #ffffff, #f9fafb)';
    const bg = allBackgrounds.find(b => b.id === backgroundId);
    return bg?.gradient || 'linear-gradient(180deg, #ffffff, #f9fafb)';
  }, [userState.user?.background]);

  const currentPattern = useMemo(() => {
    const backgroundId = userState.user?.background;
    if (!backgroundId) return undefined;
    const bg = allBackgrounds.find(b => b.id === backgroundId);
    return bg?.pattern;
  }, [userState.user?.background]);

  const starParticles = useMemo(() => ({
    stars: Array.from({ length: 20 }, (_, i): StarParticle => ({
      left: particleValue(i + 1, 0, 100),
      top: particleValue(i + 101, 0, 100),
      animationDelay: particleValue(i + 201, 0, 3),
      opacity: particleValue(i + 301, 0.2, 1),
    })),
    galaxy: Array.from({ length: 40 }, (_, i): StarParticle => ({
      left: particleValue(i + 401, 0, 100),
      top: particleValue(i + 501, 0, 100),
      animationDelay: particleValue(i + 601, 0, 3),
      opacity: particleValue(i + 701, 0.2, 1),
    })),
  }), []);

  const cherryParticles = useMemo(() => (
    Array.from({ length: 12 }, (_, i): CherryParticle => ({
      left: (i % 4) * 30 + particleValue(i + 801, 0, 20),
      top: Math.floor(i / 4) * 30 + particleValue(i + 901, 0, 20),
      animationDelay: i * 0.8,
    }))
  ), []);

  const renderBackgroundPattern = useCallback((pattern?: string) => {
    if (!pattern) return null;

    if (pattern === 'stars' || pattern === 'galaxy') {
      const particles = pattern === 'galaxy' ? starParticles.galaxy : starParticles.stars;
      return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
          {particles.map((particle, i) => (
            <div
              key={i}
              className="absolute h-1 w-1 animate-twinkle rounded-full bg-white"
              style={{
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                animationDelay: `${particle.animationDelay}s`,
                opacity: particle.opacity,
              }}
            />
          ))}
        </div>
      );
    }

    if (pattern === 'cherry') {
      return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-10">
          {cherryParticles.map((particle, i) => (
            <div
              key={i}
              className="absolute animate-float text-5xl"
              style={{
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                animationDelay: `${particle.animationDelay}s`,
              }}
            >
              🌸
            </div>
          ))}
        </div>
      );
    }

    if (pattern === 'apple-blur') {
      return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="noiseFilter">
                <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                <feColorMatrix type="saturate" values="0" />
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.05" />
                </feComponentTransfer>
              </filter>
            </defs>
            <rect width="100%" height="100%" filter="url(#noiseFilter)" />
          </svg>
          <div className="absolute left-1/4 top-0 h-32 w-1/2 rounded-full bg-white/30 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 h-32 w-1/2 rounded-full bg-white/20 blur-3xl" />
        </div>
      );
    }

    if (pattern === 'aurora') {
      return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-35">
          <div className="absolute -left-20 top-8 h-56 w-56 rounded-full bg-cyan-300/35 blur-3xl" />
          <div className="absolute left-1/3 top-1/4 h-64 w-64 rounded-full bg-indigo-300/30 blur-3xl" />
          <div className="absolute -right-16 bottom-16 h-56 w-56 rounded-full bg-fuchsia-300/25 blur-3xl" />
        </div>
      );
    }

    return null;
  }, [cherryParticles, starParticles]);

  const renderPage = () => {
    switch (userState.currentPage) {
      case 'login': return <LoginPage />;
      case 'home': return <HomePage isActive />;
      case 'profile': return <ProfilePage />;
      case 'knowledge': return <KnowledgePage isActive />;
      case 'knowledge-detail': return <KnowledgeDetailPage />;
      case 'add-knowledge': return <AddKnowledgePage />;
      case 'import-knowledge': return <ImportKnowledgePage />;
      case 'quiz': return <QuizPage isActive />;
      case 'quiz-session': return <QuizSessionPage />;
      case 'quiz-result': return <QuizResultPage />;
      case 'wrong-book': return <WrongBookPage />;
      case 'knowledge-map': return <KnowledgeMapPage />;
      case 'checkin': return <CheckinPage />;
      case 'team': return <TeamPage />;
      case 'achievements': return <AchievementsPage />;
      case 'shop': return <ShopPage />;
      case 'ranking': return <RankingPage />;
      case 'lottery': return <LotteryPage />;
      case 'ai-chat': return <AIChatPage />;
      case 'ai-study': return <AIStudyPage />;
      case 'ai-study-summaries': return <AIStudySummariesPage />;
      case 'truth-admin': return <TruthAdminPage />;
      case 'admin': return <AdminPage />;
      case 'settings': return <SettingsPage />;
      case 'inventory': return <InventoryPage />;
      case 'mail': return <MailPage />;
      case 'avatar-edit': return <AvatarEditPage />;
      case 'flashcard-learning': return <FlashcardLearningPage />;
      default: return <HomePage isActive />;
    }
  };

  const isHomeScreen = userState.currentPage === 'home';
  const isStudyWorkspace = userState.currentPage === 'flashcard-learning';
  const desktopShellPages = [
    'home',
    'knowledge',
    'quiz',
    'knowledge-map',
    'profile',
    'knowledge-detail',
    'add-knowledge',
    'import-knowledge',
    'wrong-book',
    'settings',
    'flashcard-learning',
    'ai-chat',
    'ai-study',
    'ai-study-summaries',
    'truth-admin',
    'admin',
  ];
  const isImmersivePage = userState.currentPage === 'login'
    || userState.currentPage === 'quiz-session'
    || userState.currentPage === 'quiz-result';
  const isFullScreen = isImmersivePage
    || userState.currentPage === 'ai-chat'
    || userState.currentPage === 'ai-study'
    || userState.currentPage === 'ai-study-summaries'
    || userState.currentPage === 'flashcard-learning';
  const shouldUsePhoneShell = !isLargeScreen || isImmersivePage || !desktopShellPages.includes(userState.currentPage);
  const learningExperience = calculateLearningExperience(learningState, gameState.checkin);
  const experienceTotal = learningExperience + (userState.user?.bonusExperience ?? 0);
  const levelProgress = calculateLevelProgress(experienceTotal);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      phoneScrollRef.current?.scrollTo({ top: 0, left: 0 });
      desktopContentRef.current?.scrollTo({ top: 0, left: 0 });
      window.scrollTo({ top: 0, left: 0 });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [userState.currentPage]);

  useEffect(() => {
    if (!isStudyWorkspace || !isLargeScreen) return;

    const handleStudyWorkspaceEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (isDesktopNavExpanded) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setIsDesktopNavExpanded(false);
        window.requestAnimationFrame(() => desktopNavToggleRef.current?.focus());
        return;
      }

      if (desktopSidebarState !== 'collapsed') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setDesktopSidebarState('collapsed');
        window.requestAnimationFrame(() => desktopToolsToggleRef.current?.focus());
      }
    };

    window.addEventListener('keydown', handleStudyWorkspaceEscape, true);
    return () => window.removeEventListener('keydown', handleStudyWorkspaceEscape, true);
  }, [desktopSidebarState, isDesktopNavExpanded, isLargeScreen, isStudyWorkspace]);

  useEffect(() => {
    if (!isStudyWorkspace || !isLargeScreen) return;

    const frame = window.requestAnimationFrame(() => {
      setIsDesktopNavExpanded(false);
      setDesktopSidebarState('collapsed');
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isLargeScreen, isStudyWorkspace]);

  const closeLevelUpCelebration = useCallback(() => {
    setLevelUpState(null);
  }, []);

  const viewLevelUpReward = useCallback(() => {
    setLevelUpState(null);
    navigate('inventory');
  }, [navigate]);

  useEffect(() => {
    if (!userState.isLoggedIn) {
      previousExperienceTotalRef.current = null;
      studyEventExpiresAtRef.current = 0;
      claimedRewardLevelsRef.current.clear();
      return;
    }

    const previousExperienceTotal = previousExperienceTotalRef.current;
    if (previousExperienceTotal === null) {
      previousExperienceTotalRef.current = experienceTotal;
      return;
    }

    if (experienceTotal === previousExperienceTotal) return;

    const isStudyTriggered = studyEventExpiresAtRef.current > Date.now();
    const transition = isStudyTriggered
      ? detectLevelUpTransition(previousExperienceTotal, experienceTotal)
      : null;

    previousExperienceTotalRef.current = experienceTotal;
    if (!transition) return;

    studyEventExpiresAtRef.current = 0;
    const userId = userState.user?.id ?? '';
    const timer = window.setTimeout(() => {
      setLevelUpState({
        ...transition,
        userId,
        claimingReward: transition.rewards.length > 0,
        rewardClaimed: false,
        rewardError: '',
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [experienceTotal, userState.isLoggedIn, userState.user?.id]);

  useEffect(() => {
    const reward = levelUpState?.rewards[0];
    if (!reward || !userState.isLoggedIn || claimedRewardLevelsRef.current.has(reward.level)) return;

    claimedRewardLevelsRef.current.add(reward.level);
    let cancelled = false;
    accountClaimLevelReward(reward.level, learningExperience)
      .then(payload => {
        if (cancelled) return;
        applyServerAccountPayload(payload, userDispatch, gameDispatch);
        setLevelUpState(current => current ? {
          ...current,
          claimingReward: false,
          rewardClaimed: true,
          rewardError: '',
        } : current);
      })
      .catch(err => {
        if (cancelled) return;
        logoutOnUnauthorized(err, userDispatch);
        setLevelUpState(current => current ? {
          ...current,
          claimingReward: false,
          rewardClaimed: false,
          rewardError: err instanceof Error ? err.message : '奖励发放失败，稍后可重新学习后同步。',
        } : current);
      });

    return () => {
      cancelled = true;
    };
  }, [gameDispatch, learningExperience, levelUpState?.rewards, userDispatch, userState.isLoggedIn]);

  const levelUpCelebration = (
    <LevelUpCelebration
      open={Boolean(levelUpState && levelUpState.userId === userState.user?.id)}
      previousLevel={levelUpState?.previousLevel ?? 1}
      nextLevel={levelUpState?.nextLevel ?? 1}
      rewards={levelUpState?.rewards ?? []}
      claimingReward={Boolean(levelUpState?.claimingReward)}
      rewardClaimed={Boolean(levelUpState?.rewardClaimed)}
      rewardError={levelUpState?.rewardError}
      onClose={closeLevelUpCelebration}
      onViewReward={viewLevelUpReward}
    />
  );

  if (shouldUsePhoneShell) {
    return (
      <div
        className={`fixed inset-0 flex w-full justify-center ${isHomeScreen ? 'min-h-dvh md:min-h-screen md:items-center md:bg-slate-50' : 'min-h-dvh'}`}
        style={isHomeScreen ? undefined : { background: currentBackground }}
      >
        <div
          className={`relative flex w-full max-w-[430px] flex-col overflow-hidden ${isHomeScreen ? 'min-h-dvh bg-[#F8FAFF] md:h-[860px] md:min-h-0 md:w-[430px] md:flex-none md:rounded-[var(--radius-3xl)] md:border md:border-slate-200 md:shadow-[0_30px_80px_rgba(15,23,42,0.12)]' : 'min-h-dvh'}`}
        >
          {!isHomeScreen && renderBackgroundPattern(currentPattern)}
          <div ref={phoneScrollRef} className={`relative z-10 flex-1 ${isHomeScreen || isFullScreen ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            <div className={isHomeScreen || isFullScreen ? 'h-full' : 'pb-20 safe-bottom'}>
              <Suspense fallback={<LoadingFallback />}>
                {isHomeScreen ? renderPage() : isFullScreen ? (
                  <div key={userState.currentPage} className="h-full page-fade-opacity">
                    {renderPage()}
                  </div>
                ) : (
                  <div key={userState.currentPage} className="page-fade-in">
                    {renderPage()}
                  </div>
                )}
              </Suspense>
            </div>
          </div>
          {userState.isLoggedIn && !isFullScreen && !isHomeScreen && <TabBar />}
          <AchievementPopup />
          {levelUpCelebration}
          <LotteryDrawModal />
        </div>
      </div>
    );
  }

  const desktopTabs: { key: MainTab; label: string; description: string; icon: typeof Home }[] = [
    { key: 'home', label: '首页', description: '今日学习', icon: Home },
    { key: 'knowledge', label: '知识库', description: '卡片管理', icon: BookOpen },
    { key: 'quiz', label: '刷题', description: '练习测验', icon: PenTool },
    { key: 'knowledge-map', label: '图谱', description: '知识关系', icon: Map },
    { key: 'profile', label: '我的', description: '账户档案', icon: User },
  ];

  const renderDesktopPage = () => {
    switch (userState.currentPage) {
      case 'home': return <HomePage isActive showBottomNav={false} />;
      case 'knowledge': return <KnowledgePage isActive />;
      case 'quiz': return <QuizPage isActive />;
      case 'knowledge-map': return <KnowledgeMapPage />;
      case 'profile': return <ProfilePage />;
      case 'knowledge-detail': return <KnowledgeDetailPage />;
      case 'add-knowledge': return <AddKnowledgePage />;
      case 'import-knowledge': return <ImportKnowledgePage />;
      case 'wrong-book': return <WrongBookPage />;
      case 'settings': return <SettingsPage />;
      case 'flashcard-learning': return <FlashcardLearningPage embedded onAskAI={openDesktopAI} />;
      case 'ai-study': return <AIStudyPage onOpenTutor={openDesktopTutor} />;
      case 'ai-study-summaries': return <AIStudySummariesPage />;
      case 'truth-admin': return <TruthAdminPage />;
      case 'admin': return <AdminPage />;
      case 'ai-chat': return <AIChatPage />;
      default: return <HomePage isActive showBottomNav={false} />;
    }
  };

  const desktopPageTitles: Record<string, string> = {
    'knowledge-detail': '知识点详情',
    'add-knowledge': '添加知识',
    'import-knowledge': '导入知识',
    'wrong-book': '错题本',
    settings: '设置',
    'flashcard-learning': '学习',
    'ai-chat': 'AI 助手',
    'truth-admin': '求真图片库',
    admin: '管理后台',
  };
  const pageTitle = desktopTabs.find(tab => tab.key === userState.currentPage)?.label
    ?? desktopPageTitles[userState.currentPage]
    ?? '学习';
  const desktopSurface = isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.86)';
  const desktopMutedSurface = isDark ? 'rgba(30, 41, 59, 0.72)' : 'rgba(248, 250, 252, 0.9)';
  const desktopBorder = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.24)';
  const desktopText = theme.textPrimary || (isDark ? '#f8fafc' : '#0f172a');
  const desktopMuted = theme.textSecondary || (isDark ? '#cbd5e1' : '#64748b');
  const desktopAccent = theme.primary || '#4f46e5';

  const closeDesktopNav = () => {
    setIsDesktopNavExpanded(false);
    window.requestAnimationFrame(() => desktopNavToggleRef.current?.focus());
  };

  const closeDesktopTools = () => {
    setDesktopSidebarState('collapsed');
    window.requestAnimationFrame(() => desktopToolsToggleRef.current?.focus());
  };

  const openDesktopNav = () => {
    setDesktopSidebarState('collapsed');
    setIsDesktopNavExpanded(true);
  };

  const openDesktopTools = (state: Exclude<DesktopSidebarState, 'collapsed'>) => {
    setIsDesktopNavExpanded(false);
    setDesktopSidebarState(state);
  };

  const navigateFromDesktopNav = (page: MainTab | 'settings' | 'flashcard-learning') => {
    setIsDesktopNavExpanded(false);
    navigate(page);
  };

  if (isStudyWorkspace) {
    const hasOpenDesktopDrawer = isDesktopNavExpanded || desktopSidebarState !== 'collapsed';

    return (
      <div className="fixed inset-0 overflow-hidden" style={{ background: currentBackground }}>
        {renderBackgroundPattern(currentPattern)}
        <div className="relative z-10 h-full p-2 min-[1440px]:p-3">
          <div
            className="relative grid h-full w-full grid-cols-[64px_minmax(0,1fr)_64px] gap-2 overflow-hidden rounded-[26px] border p-2 shadow-[0_28px_90px_rgba(15,23,42,0.16)] backdrop-blur-2xl"
            style={{
              backgroundColor: isDark ? 'rgba(2, 6, 23, 0.52)' : 'rgba(248, 250, 252, 0.76)',
              borderColor: desktopBorder,
            }}
          >
            <aside
              className="relative z-20 flex min-h-0 flex-col items-center gap-2 rounded-[20px] border px-2 py-3"
              style={{ backgroundColor: desktopSurface, borderColor: desktopBorder }}
              aria-label="学习页导航工具栏"
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl text-base font-extrabold text-white shadow-[0_10px_24px_rgba(79,70,229,0.24)]"
                style={{ backgroundColor: desktopAccent }}
                title="Smart Study"
              >
                S
              </div>
              <button
                ref={desktopNavToggleRef}
                onClick={openDesktopNav}
                className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ backgroundColor: desktopMutedSurface, borderColor: desktopBorder, color: desktopMuted }}
                title="展开导航"
                aria-label="展开导航"
                aria-expanded={isDesktopNavExpanded}
                aria-controls="study-desktop-navigation"
              >
                <PanelLeftOpen size={18} />
              </button>
              <nav className="mt-1 flex min-h-0 flex-1 flex-col items-center gap-2" aria-label="主导航">
                {desktopTabs.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => navigateFromDesktopNav(tab.key)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      style={{ backgroundColor: desktopMutedSurface, color: desktopMuted }}
                      title={tab.label}
                      aria-label={tab.label}
                    >
                      <Icon size={18} />
                    </button>
                  );
                })}
              </nav>
              <button
                onClick={() => navigateFromDesktopNav('settings')}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ backgroundColor: desktopMutedSurface, color: desktopMuted }}
                title="设置"
                aria-label="设置"
              >
                <Settings size={18} />
              </button>
            </aside>

            <main
              ref={desktopContentRef}
              className="relative z-10 min-h-0 min-w-0 overflow-hidden"
              style={{ backgroundColor: theme.surface || theme.bg }}
            >
              <Suspense fallback={<LoadingFallback />}>
                <FlashcardLearningPage embedded onAskAI={openDesktopAI} />
              </Suspense>
            </main>

            <aside
              className="relative z-20 flex min-h-0 flex-col items-center gap-3 rounded-[20px] border p-2"
              style={{ backgroundColor: desktopSurface, borderColor: desktopBorder }}
              aria-label="学习辅助工具栏"
            >
              <button
                ref={desktopToolsToggleRef}
                onClick={() => openDesktopTools('overview')}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ backgroundColor: desktopMutedSurface, borderColor: desktopBorder, color: desktopMuted }}
                title="展开学习概览"
                aria-label="展开学习概览"
                aria-expanded={desktopSidebarState === 'overview'}
                aria-controls="study-desktop-tools"
              >
                <PanelRightOpen size={18} />
              </button>
              <button
                onClick={() => openDesktopAI()}
                className="flex h-11 w-11 items-center justify-center rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ backgroundColor: `${desktopAccent}14`, color: desktopAccent }}
                title="AI 问答"
                aria-label="打开 AI 问答"
                aria-expanded={desktopSidebarState === 'ai'}
              >
                <Brain size={18} />
              </button>
              <div
                className="flex h-11 w-11 flex-col items-center justify-center rounded-2xl"
                style={{ backgroundColor: desktopMutedSurface, color: desktopText }}
                title={`Lv.${levelProgress.level} · ${experienceTotal} EXP`}
              >
                <span className="text-[9px] font-semibold" style={{ color: desktopMuted }}>LV</span>
                <span className="text-xs font-extrabold">{levelProgress.level}</span>
              </div>
              <div
                className="flex h-11 w-11 flex-col items-center justify-center rounded-2xl"
                style={{ backgroundColor: desktopMutedSurface, color: desktopText }}
                title={`连续签到 ${gameState.checkin.streak} 天`}
              >
                <Trophy size={14} style={{ color: desktopAccent }} />
                <span className="mt-0.5 text-[10px] font-bold">{gameState.checkin.streak}</span>
              </div>
            </aside>

            {hasOpenDesktopDrawer && (
              <button
                type="button"
                onClick={() => {
                  if (isDesktopNavExpanded) closeDesktopNav();
                  if (desktopSidebarState !== 'collapsed') closeDesktopTools();
                }}
                className="absolute inset-2 z-30 rounded-[20px] bg-slate-950/10 backdrop-blur-[1px] focus-visible:outline-none"
                aria-label="关闭已展开的侧栏"
              />
            )}

            <aside
              id="study-desktop-navigation"
              className={`study-desktop-drawer absolute bottom-2 left-2 top-2 z-40 flex w-[240px] flex-col rounded-[22px] border p-4 shadow-[0_24px_70px_rgba(15,23,42,0.22)] transition-transform duration-200 ${
                isDesktopNavExpanded ? 'translate-x-0' : 'pointer-events-none -translate-x-[calc(100%+1rem)]'
              }`}
              style={{ backgroundColor: desktopSurface, borderColor: desktopBorder }}
              aria-hidden={!isDesktopNavExpanded}
              inert={!isDesktopNavExpanded}
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-base font-extrabold text-white" style={{ backgroundColor: desktopAccent }}>
                  S
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[17px] font-extrabold" style={{ color: desktopText }}>Smart Study</div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.textMuted || desktopMuted }}>Desktop</div>
                </div>
                <button
                  onClick={closeDesktopNav}
                  className="flex h-9 w-9 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ backgroundColor: desktopMutedSurface, color: desktopMuted }}
                  title="收起导航"
                  aria-label="收起导航"
                >
                  <X size={17} />
                </button>
              </div>
              <nav className="space-y-2" aria-label="展开的主导航">
                {desktopTabs.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => navigateFromDesktopNav(tab.key)}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      style={{ color: desktopMuted }}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: desktopMutedSurface }}>
                        <Icon size={18} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold">{tab.label}</span>
                        <span className="mt-0.5 block text-xs" style={{ color: theme.textMuted || desktopMuted }}>{tab.description}</span>
                      </span>
                    </button>
                  );
                })}
              </nav>
              <div className="mt-auto space-y-3">
                <button
                  onClick={() => navigateFromDesktopNav('flashcard-learning')}
                  className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ backgroundColor: desktopAccent }}
                >
                  <span>
                    <span className="block text-sm font-bold">继续学习</span>
                    <span className="mt-0.5 block text-xs text-white/75">返回当前卡片</span>
                  </span>
                  <ChevronRight size={18} />
                </button>
                <button
                  onClick={() => navigateFromDesktopNav('settings')}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ backgroundColor: desktopMutedSurface, color: desktopMuted }}
                >
                  <Settings size={17} />
                  设置
                </button>
              </div>
            </aside>

            <aside
              id="study-desktop-tools"
              className={`study-desktop-drawer absolute bottom-2 right-2 top-2 z-40 overflow-hidden rounded-[22px] border shadow-[0_24px_70px_rgba(15,23,42,0.22)] transition-[width,transform] duration-200 ${
                desktopSidebarState === 'ai'
                  ? 'w-[380px] translate-x-0'
                  : desktopSidebarState === 'overview'
                    ? 'w-[260px] translate-x-0'
                    : 'pointer-events-none w-[260px] translate-x-[calc(100%+1rem)]'
              }`}
              style={{ backgroundColor: desktopSurface, borderColor: desktopBorder }}
              aria-hidden={desktopSidebarState === 'collapsed'}
              inert={desktopSidebarState === 'collapsed'}
            >
              <div className={desktopSidebarState === 'overview' ? 'flex h-full flex-col p-4' : 'hidden'}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: theme.textMuted || desktopMuted }}>Overview</div>
                    <h2 className="mt-1 text-lg font-extrabold" style={{ color: desktopText }}>学习概览</h2>
                  </div>
                  <button
                    onClick={closeDesktopTools}
                    className="flex h-9 w-9 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{ backgroundColor: desktopMutedSurface, color: desktopMuted }}
                    title="收起侧栏"
                    aria-label="收起侧栏"
                  >
                    <PanelRightClose size={17} />
                  </button>
                </div>
                <div className="mt-5 rounded-2xl p-4" style={{ backgroundColor: desktopMutedSurface }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold" style={{ color: desktopMuted }}>当前等级</div>
                      <div className="mt-1 text-2xl font-extrabold" style={{ color: desktopText }}>Lv.{levelProgress.level}</div>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${desktopAccent}16`, color: desktopAccent }}>
                      <Sparkles size={20} />
                    </div>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: theme.border }}>
                    <div className="h-full rounded-full" style={{ width: `${levelProgress.progressPercent}%`, backgroundColor: desktopAccent }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-semibold" style={{ color: desktopMuted }}>
                    <span>{experienceTotal.toLocaleString()} EXP</span>
                    <span>{levelProgress.currentLevelExp}/{levelProgress.nextLevelExp}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3 rounded-2xl p-4" style={{ backgroundColor: desktopMutedSurface }}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${desktopAccent}14`, color: desktopAccent }}>
                    <Trophy size={18} />
                  </span>
                  <div>
                    <div className="text-xs font-semibold" style={{ color: desktopMuted }}>连续签到</div>
                    <div className="mt-0.5 text-lg font-extrabold" style={{ color: desktopText }}>{gameState.checkin.streak} 天</div>
                  </div>
                </div>
                <button
                  onClick={() => openDesktopAI()}
                  className="mt-3 flex w-full items-center gap-3 rounded-2xl p-4 text-left text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ backgroundColor: desktopAccent }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                    <MessageCircle size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">AI 问答</span>
                    <span className="mt-0.5 block text-[11px] text-white/75">学习时随时提问</span>
                  </span>
                  <ChevronRight size={17} />
                </button>
              </div>

              <div className={desktopSidebarState === 'ai' ? 'h-full min-h-0 p-2' : 'hidden'}>
                {isDesktopAiMounted && (
                  <div className="h-full min-h-0 overflow-hidden rounded-[18px] border" style={{ borderColor: desktopBorder }}>
                    <Suspense fallback={<LoadingFallback />}>
                      {desktopAiMode === 'tutor' && desktopTutorContext ? (
                        <StudyTutorPanel context={desktopTutorContext} onClose={closeDesktopTools} />
                      ) : (
                        <AIChatPage embedded embeddedQuestionContext={desktopQuestionContext} onClose={closeDesktopTools} />
                      )}
                    </Suspense>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
        <AchievementPopup />
        {levelUpCelebration}
        <LotteryDrawModal />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: currentBackground }}>
      {renderBackgroundPattern(currentPattern)}
      <div className="relative z-10 flex h-full items-center justify-center p-3 min-[1440px]:p-5">
        <div
          className={`relative grid h-full max-h-[940px] w-full max-w-[1720px] gap-3 rounded-[28px] border p-3 shadow-[0_28px_90px_rgba(15,23,42,0.16)] backdrop-blur-2xl ${
            isWideDesktop ? 'grid-cols-[220px_minmax(720px,1fr)_auto]' : 'grid-cols-[220px_minmax(0,1fr)]'
          }`}
          style={{ backgroundColor: isDark ? 'rgba(2, 6, 23, 0.52)' : 'rgba(248, 250, 252, 0.76)', borderColor: desktopBorder }}
        >
          <aside className="flex min-h-0 flex-col rounded-[24px] border p-4" style={{ backgroundColor: desktopSurface, borderColor: desktopBorder }}>
            <div className="mb-7 flex items-center gap-3 px-1">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-base font-extrabold text-white shadow-[0_12px_26px_rgba(79,70,229,0.28)]" style={{ backgroundColor: desktopAccent }}>
                S
              </div>
              <div className="min-w-0">
                <div className="truncate text-[17px] font-extrabold" style={{ color: desktopText }}>Smart Study</div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.textMuted || desktopMuted }}>Desktop</div>
              </div>
            </div>

            <nav className="space-y-2">
              {desktopTabs.map(tab => {
                const Icon = tab.icon;
                const active = userState.currentPage === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => navigate(tab.key)}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                      backgroundColor: active ? `${desktopAccent}18` : 'transparent',
                      color: active ? desktopAccent : desktopMuted,
                    }}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: active ? desktopAccent : desktopMutedSurface, color: active ? '#ffffff' : desktopMuted }}
                    >
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{tab.label}</span>
                      <span className="mt-0.5 block text-xs" style={{ color: active ? desktopAccent : theme.textMuted || desktopMuted }}>{tab.description}</span>
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto space-y-3">
              <button
                onClick={() => navigate('flashcard-learning')}
                className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-white shadow-[0_12px_30px_rgba(79,70,229,0.24)] transition-transform active:scale-[0.98]"
                style={{ backgroundColor: desktopAccent }}
              >
                <span>
                  <span className="block text-sm font-bold">开始学习</span>
                  <span className="mt-0.5 block text-xs text-white/72">进入卡片复习</span>
                </span>
                <ChevronRight size={18} />
              </button>
              <button
                onClick={() => navigate('settings')}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold"
                style={{ backgroundColor: desktopMutedSurface, color: desktopMuted }}
              >
                <Settings size={17} />
                设置
              </button>
            </div>
          </aside>

          <main className="flex min-h-0 flex-col rounded-[24px] border" style={{ backgroundColor: isDark ? 'rgba(15, 23, 42, 0.42)' : 'rgba(255, 255, 255, 0.48)', borderColor: desktopBorder }}>
            <div className="shrink-0 border-b px-6 py-4" style={{ borderColor: desktopBorder }}>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.textMuted || desktopMuted }}>Learning workspace</div>
                <h1 className="mt-1 text-2xl font-extrabold" style={{ color: desktopText }}>{pageTitle}</h1>
              </div>
            </div>
            <div className="min-h-0 flex-1 p-4">
              <div
                ref={desktopContentRef}
                className={`desktop-content-stage relative h-full w-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${isStudyWorkspace ? 'rounded-[28px]' : 'rounded-[24px] border shadow-[0_20px_56px_rgba(15,23,42,0.12)]'}`}
                style={{
                  backgroundColor: isStudyWorkspace
                    ? (theme.surface || theme.bg)
                    : (isDark ? 'rgba(15, 23, 42, 0.78)' : '#f8faff'),
                  borderColor: desktopBorder,
                }}
              >
                <div className="h-full min-h-0">
                  <Suspense fallback={<LoadingFallback />}>
                    {renderDesktopPage()}
                  </Suspense>
                </div>
              </div>
            </div>
          </main>

          <aside
            className={`${isWideDesktop ? 'relative' : 'absolute bottom-3 right-3 top-3 z-40 shadow-[0_24px_70px_rgba(15,23,42,0.2)]'} min-h-0 overflow-hidden rounded-[24px] border transition-[width] duration-300 ${
              desktopSidebarState === 'ai'
                ? 'w-[340px]'
                : desktopSidebarState === 'overview'
                  ? 'w-[220px]'
                  : 'w-[64px]'
            }`}
            style={{ backgroundColor: desktopSurface, borderColor: desktopBorder }}
          >
            <div className={desktopSidebarState === 'collapsed' ? 'flex h-full flex-col items-center gap-3 p-2' : 'hidden'}>
              <button
                onClick={() => setDesktopSidebarState('overview')}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border"
                style={{ backgroundColor: desktopMutedSurface, borderColor: desktopBorder, color: desktopMuted }}
                title="展开侧栏"
                aria-label="展开侧栏"
              >
                <PanelRightOpen size={18} />
              </button>
              <button
                onClick={() => openDesktopAI()}
                className="flex h-11 w-11 items-center justify-center rounded-2xl transition-colors hover:bg-indigo-50"
                style={{ backgroundColor: `${desktopAccent}14`, color: desktopAccent }}
                title="AI 问答"
                aria-label="打开 AI 问答"
              >
                <Brain size={18} />
              </button>
              <div
                className="flex h-11 w-11 flex-col items-center justify-center rounded-2xl"
                style={{ backgroundColor: desktopMutedSurface, color: desktopText }}
                title={`Lv.${levelProgress.level} · ${experienceTotal} EXP`}
              >
                <span className="text-[9px] font-semibold" style={{ color: desktopMuted }}>LV</span>
                <span className="text-xs font-extrabold">{levelProgress.level}</span>
              </div>
              <div
                className="flex h-11 w-11 flex-col items-center justify-center rounded-2xl"
                style={{ backgroundColor: desktopMutedSurface, color: desktopText }}
                title={`连续签到 ${gameState.checkin.streak} 天`}
              >
                <Trophy size={14} style={{ color: desktopAccent }} />
                <span className="mt-0.5 text-[10px] font-bold">{gameState.checkin.streak}</span>
              </div>
            </div>

            <div className={desktopSidebarState === 'overview' ? 'flex h-full flex-col p-3' : 'hidden'}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: theme.textMuted || desktopMuted }}>Overview</div>
                  <h2 className="mt-1 text-lg font-extrabold" style={{ color: desktopText }}>学习概览</h2>
                </div>
                <button
                  onClick={() => setDesktopSidebarState('collapsed')}
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: desktopMutedSurface, color: desktopMuted }}
                  title="收起侧栏"
                  aria-label="收起侧栏"
                >
                  <PanelRightClose size={17} />
                </button>
              </div>

              <div className="mt-5 rounded-2xl p-4" style={{ backgroundColor: desktopMutedSurface }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold" style={{ color: desktopMuted }}>当前等级</div>
                    <div className="mt-1 text-2xl font-extrabold" style={{ color: desktopText }}>Lv.{levelProgress.level}</div>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${desktopAccent}16`, color: desktopAccent }}>
                    <Sparkles size={20} />
                  </div>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: theme.border }}>
                  <div className="h-full rounded-full" style={{ width: `${levelProgress.progressPercent}%`, backgroundColor: desktopAccent }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] font-semibold" style={{ color: desktopMuted }}>
                  <span>{experienceTotal.toLocaleString()} EXP</span>
                  <span>{levelProgress.currentLevelExp}/{levelProgress.nextLevelExp}</span>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3 rounded-2xl p-4" style={{ backgroundColor: desktopMutedSurface }}>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${desktopAccent}14`, color: desktopAccent }}>
                  <Trophy size={18} />
                </span>
                <div>
                  <div className="text-xs font-semibold" style={{ color: desktopMuted }}>连续签到</div>
                  <div className="mt-0.5 text-lg font-extrabold" style={{ color: desktopText }}>{gameState.checkin.streak} 天</div>
                </div>
              </div>

              <button
                onClick={() => openDesktopAI()}
                className="mt-3 flex w-full items-center gap-3 rounded-2xl p-4 text-left text-white shadow-[0_12px_28px_rgba(79,70,229,0.2)] transition-transform active:scale-[0.98]"
                style={{ backgroundColor: desktopAccent }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/16">
                  <MessageCircle size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">AI 问答</span>
                  <span className="mt-0.5 block text-[11px] text-white/75">学习时随时提问</span>
                </span>
                <ChevronRight size={17} />
              </button>
            </div>

            <div className={desktopSidebarState === 'ai' ? 'h-full min-h-0 p-2' : 'pointer-events-none absolute inset-0 invisible'}>
              {isDesktopAiMounted && (
                <div className="h-full min-h-0 overflow-hidden rounded-[18px] border" style={{ borderColor: desktopBorder }}>
                  <Suspense fallback={<LoadingFallback />}>
                    {desktopAiMode === 'tutor' && desktopTutorContext ? (
                      <StudyTutorPanel
                        context={desktopTutorContext}
                        onClose={() => setDesktopSidebarState('collapsed')}
                      />
                    ) : (
                      <AIChatPage
                        embedded
                        embeddedQuestionContext={desktopQuestionContext}
                        onClose={() => setDesktopSidebarState('collapsed')}
                      />
                    )}
                  </Suspense>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
      <AchievementPopup />
      {levelUpCelebration}
      <LotteryDrawModal />
    </div>
  );
}

export default function App() {
  return (
    <div className="app-shell bg-transparent">
      <ThemeStyles />
      <AppContent />
    </div>
  );
}
