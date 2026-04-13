/**
 * ============================================================================
 * 底部导航栏 (TabBar)
 * ============================================================================
 *
 * 【功能】
 * - Scholar 风格：4 个主 Tab (HOME / LIBRARY / AI TUTOR / PROFILE)
 * - Playful 风格：5 个主 Tab (首页/知识库/刷题/图谱/我的)
 *
 * 【hiddenPages 中的页面不显示 TabBar】
 * - 答题中、AI聊天等沉浸式页面
 * ============================================================================
 */

import { Home, BookOpen, PenTool, Network, User, Sparkles } from 'lucide-react';
import { useUser } from '@/store/UserContext';
import { useTheme } from '@/store/ThemeContext';
import { UILAYOUT_CONFIGS } from '@/types';
import type { PageName } from '@/types';

interface TabItem {
  key: PageName;
  label: string;
  icon: typeof Home;
  scholarLabel?: string;
}

const tabs: TabItem[] = [
  { key: 'home', label: '首页', icon: Home, scholarLabel: 'HOME' },
  { key: 'knowledge', label: '知识库', icon: BookOpen, scholarLabel: 'LIBRARY' },
  { key: 'quiz', label: '刷题', icon: PenTool },
  { key: 'knowledge-map', label: '图谱', icon: Network },
  { key: 'profile', label: '我的', icon: User, scholarLabel: 'PROFILE' },
];

const scholarTabs: TabItem[] = [
  { key: 'home', label: 'HOME', icon: Home },
  { key: 'knowledge', label: 'LIBRARY', icon: BookOpen },
  { key: 'ai-chat', label: 'AI TUTOR', icon: Sparkles },
  { key: 'profile', label: 'PROFILE', icon: User },
];

const playfulHiddenPages: PageName[] = ['login', 'quiz-session', 'quiz-result', 'review-session', 'add-knowledge', 'ai-chat', 'inventory', 'mail', 'import-knowledge'];
const scholarHiddenPages: PageName[] = ['login', 'quiz-session', 'quiz-result', 'review-session', 'add-knowledge', 'inventory', 'mail', 'import-knowledge'];

export default function TabBar() {
  const { userState, navigate } = useUser();
  const { theme } = useTheme();

  const uiStyle = theme.uiStyle || 'playful';
  const layoutConfig = UILAYOUT_CONFIGS[uiStyle];
  const hiddenPages = uiStyle === 'scholar' ? scholarHiddenPages : playfulHiddenPages;

  if (hiddenPages.includes(userState.currentPage)) {
    return null;
  }

  if (uiStyle === 'scholar') {
    return (
      <nav
        className="fixed bottom-0 left-0 w-full z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div
          className="flex items-center justify-around px-2 py-2"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: '0 -1px 0 rgba(197, 197, 212, 0.3), 0 -8px 24px -4px rgba(25, 28, 29, 0.04)',
          }}
        >
          {scholarTabs.map(tab => {
            const isActive = userState.currentPage === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => navigate(tab.key)}
                className="flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all duration-200"
              >
                {isActive ? (
                  <>
                    <div
                      className="px-5 py-2 rounded-full transition-all"
                      style={{ backgroundColor: layoutConfig.tabBarActiveBg || '#dee0ff' }}
                    >
                      <Icon
                        size={20}
                        style={{ color: layoutConfig.tabBarActiveColor || '#24389c' }}
                        strokeWidth={2.5}
                      />
                    </div>
                    <span
                      className="text-[10px] font-bold tracking-wide"
                      style={{ color: layoutConfig.tabBarActiveColor || '#24389c' }}
                    >
                      {tab.label}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="px-5 py-2">
                      <Icon
                        size={20}
                        style={{ color: theme.onSurfaceVariant || '#454652' }}
                        strokeWidth={1.8}
                      />
                    </div>
                    <span
                      className="text-[10px] tracking-wide"
                      style={{ color: theme.onSurfaceVariant || '#454652' }}
                    >
                      {tab.label}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="bg-white/70 backdrop-blur-xl border-t border-white/20">
        <div className="flex items-center justify-around h-[56px]">
          {tabs.map(tab => {
            const isActive = userState.currentPage === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => navigate(tab.key)}
                className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-200 rounded-full mx-1 ${isActive ? 'bg-primary/10 scale-105' : 'active:opacity-60'}`}
              >
                <Icon
                  size={isActive ? 22 : 20}
                  className={isActive ? 'text-primary' : 'text-text-muted'}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                <span className={`text-[10px] leading-tight ${isActive ? 'text-primary font-semibold' : 'text-text-muted'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
