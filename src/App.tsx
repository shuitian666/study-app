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
 * 【当前页面清单】19 个
 * 核心 (P1): login, home, profile, knowledge, knowledge-detail, add-knowledge,
 *            quiz, quiz-session, quiz-result, wrong-book, knowledge-map, review-session
 * 激励 (P2): checkin, achievements, shop, ranking, lottery
 * AI (P3):   ai-chat
 * ============================================================================
 */

import { useApp } from '@/store/AppContext';
import TabBar from '@/components/layout/TabBar';
import AchievementPopup from '@/components/ui/AchievementPopup';
import LotteryDrawModal from '@/components/ui/LotteryDrawModal';
import LoginPage from '@/pages/Login';
import HomePage from '@/pages/Home';
import ProfilePage from '@/pages/Profile';
import KnowledgePage from '@/pages/Knowledge';
import KnowledgeDetailPage from '@/pages/Knowledge/KnowledgeDetail';
import AddKnowledgePage from '@/pages/Knowledge/AddKnowledge';
import ImportKnowledgePage from '@/pages/Knowledge/ImportKnowledge';
import QuizPage from '@/pages/Quiz';
import QuizSessionPage from '@/pages/Quiz/QuizSession';
import QuizResultPage from '@/pages/Quiz/QuizResult';
import WrongBookPage from '@/pages/Quiz/WrongBook';
import KnowledgeMapPage from '@/pages/KnowledgeMap';
import ReviewSessionPage from '@/pages/Review';
import CheckinPage from '@/pages/Checkin';
import AchievementsPage from '@/pages/Achievements';
import ShopPage from '@/pages/Shop';
import RankingPage from '@/pages/Ranking';
import LotteryPage from '@/pages/Lottery';
import AIChatPage from '@/pages/AIChat';
import SettingsPage from '@/pages/Settings';
import InventoryPage from '@/pages/Inventory';
import MailPage from '@/pages/Mail';

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
      default: return <HomePage />;
    }
  };

  const isFullScreen = state.currentPage === 'login' || state.currentPage === 'quiz-result' || state.currentPage === 'ai-chat';

  if (isFullScreen) {
    return renderPage();
  }

  return (
    <>
      <div className="scroll-container">
        {renderPage()}
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
