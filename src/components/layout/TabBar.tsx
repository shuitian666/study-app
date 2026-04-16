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
      <div
        className="fixed bottom-0 left-0 right-0 z-50 w-full pointer-events-none flex justify-center"
        style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <nav
          className="w-full max-w-[390px] px-4 pointer-events-auto"
          style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
        >
        <div
          className="pointer-events-auto mx-auto w-full items-center justify-around rounded-[28px] border px-3 py-2 flex"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            borderColor: 'rgba(197, 197, 212, 0.35)',
            boxShadow: '0 20px 44px -30px rgba(15, 23, 42, 0.3), 0 1px 0 rgba(255,255,255,0.7) inset',
          }}
        >
          {scholarTabs.map(tab => {
            const isActive = userState.currentPage === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => navigate(tab.key)}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-all duration-200"
              >
                {isActive ? (
                  <>
                    <div
                      className="rounded-full p-2 mx-1 transition-all flex items-center justify-center"
                      style={{
                        backgroundColor: layoutConfig.tabBarActiveBg || '#dee0ff',
                        boxShadow: '0 12px 24px -18px rgba(36, 56, 156, 0.55)',
                      }}
                    >
                      <Icon
                        size={20}
                        style={{ color: layoutConfig.tabBarActiveColor || '#24389c' }}
                        strokeWidth={2.5}
                      />
                    </div>
                    <span
                      className="text-[9px] font-bold tracking-normal leading-tight"
                      style={{ color: layoutConfig.tabBarActiveColor || '#24389c' }}
                    >
                      {tab.label}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="p-2 mx-1 rounded-full flex items-center justify-center">
                      <Icon
                        size={20}
                        style={{ color: theme.onSurfaceVariant || '#454652' }}
                        strokeWidth={1.8}
                      />
                    </div>
                    <span
                      className="text-[9px] tracking-normal leading-tight"
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
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 safe-bottom w-full pointer-events-none flex justify-center" style={{ background: 'rgba(255, 255, 255, 0.82)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-[390px] px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pointer-events-auto md:px-6">
        <div className="mx-auto w-full rounded-[28px] border border-white/55 bg-white/82 backdrop-blur-xl shadow-[0_18px_42px_-28px_rgba(15,23,42,0.34)]">
          <div className="flex h-[62px] items-center justify-around px-3">
          {tabs.map(tab => {
            const isActive = userState.currentPage === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => navigate(tab.key)}
                className={`mx-1 flex h-full flex-1 flex-col items-center justify-center gap-1 rounded-full transition-all duration-200 ${isActive ? 'bg-primary/10 scale-[1.02]' : 'active:opacity-60'}`}
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
    </div>
  );
}
