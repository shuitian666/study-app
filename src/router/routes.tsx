import React, { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { RootProvider } from '../store/RootProvider';
import App from '../App';

// 懒加载所有页面组件
const Home = lazy(() => import('../pages/Home'));
const Knowledge = lazy(() => import('../pages/Knowledge'));
const KnowledgeDetail = lazy(() => import('../pages/Knowledge/KnowledgeDetail'));
const AddKnowledge = lazy(() => import('../pages/Knowledge/AddKnowledge'));
const ImportKnowledge = lazy(() => import('../pages/Knowledge/ImportKnowledge'));
const QuizIndex = lazy(() => import('../pages/Quiz'));
const QuizSession = lazy(() => import('../pages/Quiz/QuizSession'));
const QuizResult = lazy(() => import('../pages/Quiz/QuizResult'));
const WrongBook = lazy(() => import('../pages/Quiz/WrongBook'));
const FlashcardLearning = lazy(() => import('../pages/FlashcardLearning'));
const AIChat = lazy(() => import('../pages/AIChat'));
const Profile = lazy(() => import('../pages/Profile'));
const CoinBillPage = lazy(() => import('../features/gamification/coin-bill'));
const Inventory = lazy(() => import('../features/gamification/inventory'));
const Mail = lazy(() => import('../features/gamification/mail'));
const Shop = lazy(() => import('../features/gamification/shop'));
const Lottery = lazy(() => import('../features/gamification/lottery'));
const Settings = lazy(() => import('../pages/Settings'));
const Login = lazy(() => import('../pages/Login'));
const AvatarEdit = lazy(() => import('../pages/AvatarEdit'));
const KnowledgeMap = lazy(() => import('../pages/KnowledgeMap'));
const Checkin = lazy(() => import('../features/gamification/checkin'));
const Achievements = lazy(() => import('../features/gamification/achievements'));
const Ranking = lazy(() => import('../features/gamification/ranking'));
const ReviewSession = lazy(() => import('../pages/Review'));

const PageLoading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    加载中...
  </div>
);

// 懒加载包装器
const withLazy = (Component: React.ComponentType) => (
  <React.Suspense fallback={<PageLoading />}>
    <Component />
  </React.Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <RootProvider>
        <App />
      </RootProvider>
    ),
    children: [
      { index: true, element: withLazy(Home) },
      { path: 'knowledge', element: withLazy(Knowledge) },
      { path: 'knowledge/:kpId', element: withLazy(KnowledgeDetail) },
      { path: 'knowledge/add', element: withLazy(AddKnowledge) },
      { path: 'knowledge/import', element: withLazy(ImportKnowledge) },
      { path: 'quiz', element: withLazy(QuizIndex) },
      { path: 'quiz/session/:subjectId?/:knowledgePointId?/:stage?', element: withLazy(QuizSession) },
      { path: 'quiz/result', element: withLazy(QuizResult) },
      { path: 'quiz/wrong-book', element: withLazy(WrongBook) },
      { path: 'flashcard', element: withLazy(FlashcardLearning) },
      { path: 'ai-chat', element: withLazy(AIChat) },
      { path: 'profile', element: withLazy(Profile) },
      { path: 'profile/coin-bill', element: withLazy(CoinBillPage) },
      { path: 'gamification/inventory', element: withLazy(Inventory) },
      { path: 'gamification/mail', element: withLazy(Mail) },
      { path: 'gamification/shop', element: withLazy(Shop) },
      { path: 'gamification/lottery', element: withLazy(Lottery) },
      { path: 'settings', element: withLazy(Settings) },
      { path: 'login', element: withLazy(Login) },
      { path: 'avatar-edit', element: withLazy(AvatarEdit) },
      { path: 'knowledge-map', element: withLazy(KnowledgeMap) },
      { path: 'checkin', element: withLazy(Checkin) },
      { path: 'achievements', element: withLazy(Achievements) },
      { path: 'ranking', element: withLazy(Ranking) },
      { path: 'review-session/:type?', element: withLazy(ReviewSession) },
    ],
  },
]);
