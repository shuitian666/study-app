import { useLocation } from 'react-router-dom';
import TabBar from './TabBar';

const fullScreenRoutes = ['/quiz/session', '/quiz/result', '/flashcard', '/ai-chat'];

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  // 全屏页面判断：路径以这些开头即可
  const hideTabBar = fullScreenRoutes.some(route => location.pathname.startsWith(route));

  return (
    <>
      {children}
      {!hideTabBar && <TabBar />}
    </>
  );
};

export default Layout;
