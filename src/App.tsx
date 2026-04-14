/**
 * ============================================================================
 * 应用主入口 & 路由
 * ============================================================================
 *
 * 【路由机制】React Router v6
 * 使用 <Outlet /> 渲染子路由
 *
 * ============================================================================
 */

import { useMemo, useCallback, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '@/store/UserContext';
import { useTheme } from '@/store/ThemeContext';
import TabBar from '@/components/layout/TabBar';
import AchievementPopup from '@/components/ui/AchievementPopup';
import LotteryDrawModal from '@/components/ui/LotteryDrawModal';
import { ThemeStyles } from '@/components/ui/ThemeStyles';
import LoginPage from '@/pages/Login';
import { allBackgrounds } from '@/pages/AvatarEdit';

// 全屏页面（不需要 TabBar）- playful 模式
const playfulFullScreenPages = [
  'login', 'quiz-result', 'ai-chat', 'quiz-session', 'knowledge-detail',
  'add-knowledge', 'import-knowledge', 'review-session', 'wrong-book', 'flashcard-learning'
];

// 全屏页面 - scholar 模式（ai-chat 是主 tab，不全屏）
const scholarFullScreenPages = [
  'login', 'quiz-result', 'quiz-session', 'knowledge-detail',
  'add-knowledge', 'import-knowledge', 'review-session', 'wrong-book', 'flashcard-learning'
];

function AppContent() {
  const { userState } = useUser();
  const { theme } = useTheme();
  const location = useLocation();
  const routerNavigate = useNavigate();

  const uiStyle = theme.uiStyle || 'playful';
  const fullScreenPages = uiStyle === 'scholar' ? scholarFullScreenPages : playfulFullScreenPages;

  // 应用级路由守卫：未登录强制回登录页，已登录访问登录页则回首页
  useEffect(() => {
    if (!userState.isLoggedIn && location.pathname !== '/login') {
      routerNavigate('/login', { replace: true });
      return;
    }
    if (userState.isLoggedIn && location.pathname === '/login') {
      routerNavigate('/', { replace: true });
    }
  }, [userState.isLoggedIn, location.pathname, routerNavigate]);

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
  const renderBackgroundPattern = useCallback((pattern?: string) => {
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
          <div className="absolute top-0 left-1/4 w-1/2 h-32 bg-white/30 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-1/2 h-32 bg-white/20 rounded-full blur-3xl"></div>
        </div>
      );
    }

    return null;
  }, []);

  // 判断是否为全屏页面
  const isFullScreen = fullScreenPages.includes(userState.currentPage);
  const contentGutterClass = 'px-4 md:px-5';

  return (
    <div className="absolute inset-0 flex justify-center">
      <div className="w-full flex flex-col relative overflow-hidden" style={{ background: currentBackground }}>
        {uiStyle === 'scholar' && (
          <>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(circle at top left, rgba(255,255,255,0.75), transparent 32%), radial-gradient(circle at top right, rgba(222,224,255,0.6), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0))',
              }}
            />
            <div
              className="absolute left-[-12%] top-[8%] h-40 w-40 rounded-full blur-3xl pointer-events-none"
              style={{ backgroundColor: 'rgba(255, 223, 160, 0.28)' }}
            />
            <div
              className="absolute right-[-10%] top-[18%] h-48 w-48 rounded-full blur-3xl pointer-events-none"
              style={{ backgroundColor: 'rgba(222, 224, 255, 0.32)' }}
            />
          </>
        )}
        {renderBackgroundPattern(currentPattern)}
        <div className="flex-1 overflow-y-auto relative z-10">
          {userState.isLoggedIn ? (
            <div className={`relative pb-20 safe-bottom ${contentGutterClass}`}>
              <Outlet />
            </div>
          ) : (
            <LoginPage />
          )}
        </div>
        {userState.isLoggedIn && !isFullScreen && <TabBar />}
        {userState.isLoggedIn && <AchievementPopup />}
        {userState.isLoggedIn && <LotteryDrawModal />}
      </div>
    </div>
  );
}

export default function App() {
  const { theme } = useTheme();
  const uiStyle = theme.uiStyle || 'playful';

  const shellBg = uiStyle === 'scholar'
    ? 'linear-gradient(180deg, #f4f5f7 0%, #eceff3 100%)'
    : 'radial-gradient(circle at top, #fff3f6 0%, #ffe9ef 35%, #f8f1ff 100%)';

  const frameClass = uiStyle === 'scholar'
    ? 'relative self-center h-screen w-full max-w-[390px] overflow-hidden bg-white md:h-[calc(100vh-24px)] md:rounded-[24px] md:border md:border-[#e5e7eb] md:shadow-[0_18px_52px_-30px_rgba(17,24,39,0.35)]'
    : 'relative self-center h-screen w-full max-w-[390px] overflow-hidden bg-white md:h-[calc(100vh-24px)] md:rounded-[36px] md:border md:border-white/80 md:shadow-[0_26px_78px_-30px_rgba(244,114,182,0.35)]';

  return (
    <div className="app-shell min-h-screen items-center md:px-4 md:py-4" style={{ background: shellBg }}>
      <ThemeStyles />
      <div className={frameClass}>
        <AppContent />
      </div>
    </div>
  );
}
