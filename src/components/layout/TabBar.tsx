/**
 * ============================================================================
 * 底部导航栏 (TabBar)
 * ============================================================================
 *
 * 【功能】5 个主 Tab: 首页/知识库/刷题/图谱/我的
 *
 * 【hiddenPages 中的页面不显示 TabBar】
 * - 答题中、AI聊天等沉浸式页面
 * - 新增页面如需隐藏 TabBar → 在 hiddenPages 数组中添加对应 PageName
 *
 * 【双风格支持】
 * - playful 风格：透明背景 + 简单激活高亮
 * - scholar 风格：白色半透明 + backdrop-blur + 圆角胶囊激活 + 顶部细线
 * ============================================================================
 */

import { Home, BookOpen, PenTool, Network, User } from 'lucide-react';
import { useUser } from '@/store/UserContext';
import { useTheme } from '@/store/ThemeContext';
import { UILAYOUT_CONFIGS } from '@/types';
import type { PageName } from '@/types';

interface TabItem {
  key: PageName;
  label: string;
  icon: typeof Home;
}

const tabs: TabItem[] = [
  { key: 'home', label: '首页', icon: Home },
  { key: 'knowledge', label: '知识库', icon: BookOpen },
  { key: 'quiz', label: '刷题', icon: PenTool },
  { key: 'knowledge-map', label: '图谱', icon: Network },
  { key: 'profile', label: '我的', icon: User },
];

const hiddenPages: PageName[] = ['login', 'quiz-session', 'quiz-result', 'review-session', 'add-knowledge', 'ai-chat', 'inventory', 'mail', 'import-knowledge'];

export default function TabBar() {
  const { userState, navigate } = useUser();
  const { theme } = useTheme();

  const uiStyle = theme.uiStyle || 'playful';
  const layoutConfig = UILAYOUT_CONFIGS[uiStyle];

  if (hiddenPages.includes(userState.currentPage)) {
    return null;
  }

  // ===== Scholar 风格（Fluid Scholar）=====
  if (uiStyle === 'scholar') {
    return (
      <nav
        className="fixed bottom-0 left-0 w-full z-50 safe-bottom"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div
          className="flex items-center justify-around px-4 py-3"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '3rem 3rem 0 0',
            boxShadow: '0 -8px 24px -4px rgba(25, 28, 29, 0.06)',
          }}
        >
          {tabs.map(tab => {
            const isActive = userState.currentPage === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => navigate(tab.key)}
                className="flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all duration-300"
                style={{
                  borderRadius: '20px',
                  transform: isActive ? 'scale(0.9)' : 'scale(1)',
                }}
              >
                {isActive ? (
                  <div
                    className="px-4 py-1.5 rounded-full"
                    style={{
                      backgroundColor: layoutConfig.tabBarActiveBg || '#dee0ff',
                    }}
                  >
                    <Icon
                      size={20}
                      style={{ color: layoutConfig.tabBarActiveColor || '#24389c' }}
                      strokeWidth={2.5}
                    />
                  </div>
                ) : (
                  <Icon
                    size={20}
                    style={{ color: theme.onSurfaceVariant || '#454652' }}
                    strokeWidth={1.8}
                  />
                )}
                <span
                  className="text-[11px] font-bold tracking-wide"
                  style={{
                    color: isActive
                      ? layoutConfig.tabBarActiveColor || '#24389c'
                      : theme.onSurfaceVariant || '#454652',
                  }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // ===== Playful 风格（默认）=====
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      {/* 苹果风格：底部半透明磨砂玻璃效果 */}
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
