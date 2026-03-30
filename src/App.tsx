/**
 * ============================================================================
 * 应用主入口 & 路由
 * ============================================================================
 *
 * 【路由机制】自建路由，基于 AppState.currentPage 做 switch 渲染
 * 无需 react-router，navigate() 直接 dispatch NAVIGATE action
 *
 * 【新增页面步骤】
 * 1. 在 src/types/index.ts 的 PageName 联合类型中添加新页面名
 * 2. 在 src/pages/ 下创建页面组件
 * 3. 在此文件 import 并在 renderPage() switch 中添加 case
 * 4. 如需隐藏底部 TabBar → 在 TabBar.tsx 的 hiddenPages 中添加
 * 5. 如需全屏（无 scroll-container 包裹）→ 在 isFullScreen 条件中添加
 *
 * 【优化】使用 React.lazy 进行代码分割，减少首屏加载体积
 * ============================================================================
 */

import React, { Suspense } from 'react';
import { useApp } from '@/store/AppContext';
import TabBar from '@/components/layout/TabBar';
import AchievementPopup from '@/components/ui/AchievementPopup';
import LotteryDrawModal from '@/components/ui/LotteryDrawModal';
import { Loader2 } from 'lucide-react';

// 懒加载所有页面组件，减少首屏加载体积
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
const ReviewSessionPage = React.lazy(() => import('@/pages/Review'));
const CheckinPage = React.lazy(() => import('@/pages/Checkin'));
const AchievementsPage = React.lazy(() => import('@/pages/Achievements'));
const ShopPage = React.lazy(() => import('@/pages/Shop'));
const RankingPage = React.lazy(() => import('@/pages/Ranking'));
const LotteryPage = React.lazy(() => import('@/pages/Lottery'));
const AIChatPage = React.lazy(() => import('@/pages/AIChat'));
const SettingsPage = React.lazy(() => import('@/pages/Settings'));
const InventoryPage = React.lazy(() => import('@/pages/Inventory'));
const MailPage = React.lazy(() => import('@/pages/Mail'));
const AvatarEditPage = React.lazy(() => import('@/pages/AvatarEdit'));

// 加载占位组件
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
  </div>
);

function AppContent() {
  const { state } = useApp();

  const renderPage = () => {
    switch (state.currentPage) {
      case 'login': return <LoginPage />;
      case 'home': return <HomePage />;
      case 'profile': return <ProfilePage />;
      case 'knowledge': return <KnowledgePage />;
      case 'knowledge-detail': return <KnowledgeDetailPage />;
      case 'add-knowledge': return <AddKnowledgePage />;
      case 'import-knowledge': return <ImportKnowledgePage />;
      case 'quiz': return <QuizPage />;
      case 'quiz-session': return <QuizSessionPage />;
      case 'quiz-result': return <QuizResultPage />;
      case 'wrong-book': return <WrongBookPage />;
      case 'knowledge-map': return <KnowledgeMapPage />;
      case 'review-session': return <ReviewSessionPage />;
      case 'checkin': return <CheckinPage />;
      case 'achievements': return <AchievementsPage />;
      case 'shop': return <ShopPage />;
      case 'ranking': return <RankingPage />;
      case 'lottery': return <LotteryPage />;
      case 'ai-chat': return <AIChatPage />;
      case 'settings': return <SettingsPage />;
      case 'inventory': return <InventoryPage />;
      case 'mail': return <MailPage />;
      case 'avatar-edit': return <AvatarEditPage />;
      default: return <HomePage />;
    }
  };

  const isFullScreen = state.currentPage === 'login' || state.currentPage === 'quiz-result' || state.currentPage === 'ai-chat';

  if (isFullScreen) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        {renderPage()}
      </Suspense>
    );
  }

  return (
    <>
      <div className="scroll-container">
        <Suspense fallback={<LoadingFallback />}>
          {renderPage()}
        </Suspense>
      </div>
      {state.isLoggedIn && <TabBar />}
      <AchievementPopup />
      <LotteryDrawModal />
    </>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <AppContent />
    </div>
  );
}
