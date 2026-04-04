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

import React, { Suspense, useMemo, useState, useEffect, useRef } from 'react';
import { useUser } from '@/store/UserContext';
import TabBar from '@/components/layout/TabBar';
import AchievementPopup from '@/components/ui/AchievementPopup';
import LotteryDrawModal from '@/components/ui/LotteryDrawModal';
import { ThemeStyles } from '@/components/ui/ThemeStyles';
import { allBackgrounds } from '@/pages/AvatarEdit';
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
const CheckinPage = React.lazy(() => import('@/features/gamification/checkin'));
const AchievementsPage = React.lazy(() => import('@/features/gamification/achievements'));
const ShopPage = React.lazy(() => import('@/features/gamification/shop'));
const RankingPage = React.lazy(() => import('@/features/gamification/ranking'));
const LotteryPage = React.lazy(() => import('@/features/gamification/lottery'));
const AIChatPage = React.lazy(() => import('@/pages/AIChat'));
const SettingsPage = React.lazy(() => import('@/pages/Settings'));
const InventoryPage = React.lazy(() => import('@/features/gamification/inventory'));
const MailPage = React.lazy(() => import('@/features/gamification/mail'));
const AvatarEditPage = React.lazy(() => import('@/pages/AvatarEdit'));

// 加载占位组件
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
  </div>
);

function AppContent() {
  const { userState, navigate } = useUser();
  
  // 获取当前用户选择的背景
  const currentBackground = useMemo(() => {
    const backgroundId = userState.user?.background;
    if (!backgroundId) return 'linear-gradient(180deg, #ffffff, #f9fafb)';
    const bg = allBackgrounds.find(b => b.id === backgroundId);
    return bg?.gradient || 'linear-gradient(180deg, #ffffff, #f9fafb)';
  }, [userState.user?.background]);

  // 获取当前背景图案类型
  const currentPattern = useMemo(() => {
    const backgroundId = userState.user?.background;
    if (!backgroundId) return undefined;
    const bg = allBackgrounds.find(b => b.id === backgroundId);
    return bg?.pattern;
  }, [userState.user?.background]);

  // 渲染背景装饰图案
  const renderBackgroundPattern = (pattern?: string) => {
    if (!pattern) return null;

    if (pattern === 'stars' || pattern === 'galaxy') {
      return (
        <div className="absolute inset-0 opacity-30 pointer-events-none overflow-hidden">
          {[...Array(pattern === 'galaxy' ? 40 : 20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-twinkle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                opacity: Math.random() * 0.8 + 0.2,
              }}
            />
          ))}
        </div>
      );
    }

    if (pattern === 'cherry') {
      return (
        <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute text-5xl animate-float"
              style={{
                left: `${(i % 4) * 30 + Math.random() * 20}%`,
                top: `${Math.floor(i / 4) * 30 + Math.random() * 20}%`,
                animationDelay: `${i * 0.8}s`,
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
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
          {/* 苹果风格磨砂玻璃纹理 - 微妙的噪点效果 */}
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="noiseFilter">
                <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
                <feColorMatrix type="saturate" values="0"/>
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.05"/>
                </feComponentTransfer>
              </filter>
            </defs>
            <rect width="100%" height="100%" filter="url(#noiseFilter)"/>
          </svg>
          {/* 微妙的渐变光晕 */}
          <div className="absolute top-0 left-1/4 w-1/2 h-32 bg-white/30 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-1/2 h-32 bg-white/20 rounded-full blur-3xl"></div>
        </div>
      );
    }

    return null;
  };

  const renderPage = () => {
    switch (userState.currentPage) {
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

  const isFullScreen = userState.currentPage === 'login' || userState.currentPage === 'quiz-result' || userState.currentPage === 'ai-chat' 
    || userState.currentPage === 'quiz-session' || userState.currentPage === 'knowledge-detail' || userState.currentPage === 'add-knowledge' 
    || userState.currentPage === 'import-knowledge' || userState.currentPage === 'review-session' || userState.currentPage === 'wrong-book';

  // 五个主页面用于循环滑动切换
  const mainTabs = ['home', 'knowledge', 'quiz', 'knowledge-map', 'profile'] as const;
  type MainTab = typeof mainTabs[number];
  const currentIndex = mainTabs.indexOf(userState.currentPage as MainTab);
  const isMainTab = currentIndex >= 0;

  // 检测是否为大屏幕（电脑）启用滑动切换，小屏幕（手机）保持原有方式
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth > 768);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [offsetX, setOffsetX] = useState(0);

  // 监听屏幕尺寸变化
  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth > 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 暂时禁用大屏幕布局，测试按钮点击问题
  if (true || !isLargeScreen || !isMainTab || isFullScreen) {
    return (
      <div className="fixed inset-0 flex justify-center" style={{ background: currentBackground }}>
        <div className="w-full max-w-[480px] flex flex-col relative">
          {renderBackgroundPattern(currentPattern)}
          <div className="flex-1 overflow-y-auto relative z-10">
            <div className="pb-20 safe-bottom">
              <Suspense fallback={<LoadingFallback />}>
                {renderPage()}
              </Suspense>
            </div>
          </div>
          {userState.isLoggedIn && <TabBar />}
          <AchievementPopup />
          <LotteryDrawModal />
        </div>
      </div>
    );
  }

  // 大屏幕 + 主页面：铺满屏幕，同时**一直显示三张牌** - 前/中/后，全程都有内容不会空白
  const prevIndex = currentIndex === 0 ? mainTabs.length - 1 : currentIndex - 1;
  const nextIndex = currentIndex === mainTabs.length - 1 ? 0 : currentIndex + 1;

  const renderMainTab = (tabName: string) => {
    switch (tabName) {
      case 'home': return <HomePage />;
      case 'knowledge': return <KnowledgePage />;
      case 'quiz': return <QuizPage />;
      case 'knowledge-map': return <KnowledgeMapPage />;
      case 'profile': return <ProfilePage />;
      default: return <HomePage />;
    }
  };

  // 计算位置：三张均匀分布，全程可见
  // 每一页宽度 = 屏幕一半，最大 520px
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const pageWidth = Math.min(screenWidth * 0.5, 520);
  // 计算三个页面的基础位置：都完整可见
  const leftX = (screenWidth - pageWidth) / 2 - pageWidth; // prev 在 current 左侧，正好一个完整宽度
  const currX = (screenWidth - pageWidth) / 2;             // current 居中
  const nextX = (screenWidth - pageWidth) / 2 + pageWidth; // next 在 current 右侧，正好一个完整宽度

  const getTransform = (pageOffset: -1 | 0 | 1) => {
    const baseX = pageOffset === -1 ? leftX : pageOffset === 0 ? currX : nextX;
    const scale = pageOffset === 0 ? 1 : 0.92;
    const rotateY = pageOffset === -1 ? '8deg' : pageOffset === 1 ? '-8deg' : '0deg';
    const translateZ = pageOffset === 0 ? '30px' : '0px';
    return `translateX(calc(${baseX}px + ${offsetX * 0.8}px)) scale(${scale}) rotateY(${rotateY}) translateZ(${translateZ})`;
  };

  const getOpacity = (pageOffset: -1 | 0 | 1) => {
    if (pageOffset === 0) return 1;
    // 未拖动时两边页面完全透明
    if (!isDragging && offsetX === 0) return 0;
    // 拖动时根据偏移量计算透明度
    const baseOpacity = 0.4;
    if (pageOffset === -1 && offsetX > 0) {
      // 向右拖动时显示左侧页面
      return Math.min(baseOpacity, offsetX / (pageWidth * 0.5));
    } else if (pageOffset === 1 && offsetX < 0) {
      // 向左拖动时显示右侧页面
      return Math.min(baseOpacity, Math.abs(offsetX) / (pageWidth * 0.5));
    }
    return 0;
  };

  // 拖动结束处理：超过阈值则切换，否则回弹
  const finishSwipe = () => {
    if (!isDragging) return;
    const threshold = pageWidth * 0.3;
    if (Math.abs(offsetX) > threshold) {
      if (offsetX > 0) {
        goToPrev();
      } else {
        goToNext();
      }
    } else {
      // 回弹到原位
      setOffsetX(0);
    }
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // 检查点击目标是否是可点击元素（按钮、链接等）
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('select')) {
      return; // 不启动拖动
    }
    setIsDragging(true);
    setStartX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffsetX(e.clientX - startX);
  };

  const handleMouseUp = () => finishSwipe();
  const handleMouseLeave = () => finishSwipe();

  const handleTouchStart = (e: React.TouchEvent) => {
    // 检查触摸目标是否是可点击元素（按钮、链接等）
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('select')) {
      return; // 不启动拖动
    }
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setOffsetX(e.touches[0].clientX - startX);
  };

  const handleTouchEnd = () => finishSwipe();

  // 按钮点击切换：带动画，滑到位再更新索引
  const goToPrev = () => {
    setIsDragging(true);
    const targetOffset = pageWidth; // 向右滑一个页面宽度
    setOffsetX(targetOffset);
    setTimeout(() => {
      navigate(mainTabs[prevIndex]);
      setOffsetX(0);
      setIsDragging(false);
    }, 400);
  };

  const goToNext = () => {
    setIsDragging(true);
    const targetOffset = -pageWidth; // 向左滑一个页面宽度
    setOffsetX(targetOffset);
    setTimeout(() => {
      navigate(mainTabs[nextIndex]);
      setOffsetX(0);
      setIsDragging(false);
    }, 400);
  };

  return (
    <div className="fixed inset-0" style={{ background: currentBackground }}>
      {renderBackgroundPattern(currentPattern)}
      <div className="h-full flex flex-col relative group"
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex-1 relative overflow-hidden perspective-[1200px]">
          {/* 前一页 - 始终在左边 */}
          <div
            className="absolute top-0 bottom-0 transform-gpu transition-all duration-400 ease-out w-[50%] max-w-[520px]"
            style={{
              transform: getTransform(-1),
              opacity: getOpacity(-1),
              zIndex: 1
            }}
          >
            <div className="w-full h-full bg-white/80 backdrop-blur-sm overflow-y-auto pb-[70px]">
              <Suspense fallback={<LoadingFallback />}>
                {renderMainTab(mainTabs[prevIndex])}
              </Suspense>
            </div>
          </div>

          {/* 当前页 - 始终在中间 */}
          <div
            className="absolute top-0 bottom-0 transform-gpu transition-all duration-400 ease-out w-[50%] max-w-[520px]"
            style={{
              transform: getTransform(0),
              opacity: getOpacity(0),
              zIndex: 2
            }}
          >
            <div className="w-full h-full overflow-y-auto pb-[70px]">
              <Suspense fallback={<LoadingFallback />}>
                {renderMainTab(mainTabs[currentIndex])}
              </Suspense>
            </div>
          </div>

          {/* 后一页 - 始终在右边 */}
          <div
            className="absolute top-0 bottom-0 transform-gpu transition-all duration-400 ease-out w-[50%] max-w-[520px]"
            style={{
              transform: getTransform(1),
              opacity: getOpacity(1),
              zIndex: 1
            }}
          >
            <div className="w-full h-full bg-white/80 backdrop-blur-sm overflow-y-auto pb-[70px]">
              <Suspense fallback={<LoadingFallback />}>
                {renderMainTab(mainTabs[nextIndex])}
              </Suspense>
            </div>
          </div>

          {/* 左侧切换按钮 - 透明，鼠标靠近显示 */}
          <button
            onClick={goToPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center
              text-white/20 hover:text-white/80 bg-black/5 hover:bg-black/20 rounded-full 
              transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-110"
          >
            <span className="text-2xl font-bold">&lt;</span>
          </button>

          {/* 右侧切换按钮 - 透明，鼠标靠近显示 */}
          <button
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center
              text-white/20 hover:text-white/80 bg-black/5 hover:bg-black/20 rounded-full 
              transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-110"
          >
            <span className="text-2xl font-bold">&gt;</span>
          </button>
        </div>

        {/* 底部导航保持居中 */}
        {userState.isLoggedIn && (
          <div className="relative z-10 max-w-[520px] mx-auto bg-white">
            <TabBar />
          </div>
        )}
        <AchievementPopup />
        <LotteryDrawModal />
      </div>
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