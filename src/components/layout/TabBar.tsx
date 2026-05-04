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

interface TabBarProps {
  placement?: 'viewport' | 'contained';
}

export default function TabBar({ placement = 'viewport' }: TabBarProps) {
  const { userState, navigate } = useUser();
  const { theme } = useTheme();

  const uiStyle = theme.uiStyle || 'playful';
  const layoutConfig = UILAYOUT_CONFIGS[uiStyle];

  if (hiddenPages.includes(userState.currentPage)) {
    return null;
  }

  if (placement === 'contained') {
    const activeColor = uiStyle === 'scholar' ? (layoutConfig.tabBarActiveColor || '#24389c') : '#6366f1';
    const activeBg = uiStyle === 'scholar' ? (layoutConfig.tabBarActiveBg || '#dee0ff') : undefined;

    // Playful contained: match viewport TabBar style (flat, same height)
    if (uiStyle !== 'scholar') {
      return (
        <nav className="h-[56px] w-full border-t border-white/20 bg-white/70 backdrop-blur-xl">
          <div className="flex h-full items-center justify-around">
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
        </nav>
      );
    }

    return (
      <nav
        className="h-[78px] w-full border-t backdrop-blur-xl"
        style={{
          borderRadius: '1.75rem 1.75rem 0 0',
          backgroundColor: 'rgba(255,255,255,0.85)',
          borderColor: 'rgba(0,0,0,0.06)',
          boxShadow: '0 -8px 24px -4px rgba(15,23,42,0.06)',
        }}
      >
        <div className="flex h-full items-center justify-around px-4 pb-3 pt-2">
          {tabs.map(tab => {
            const isActive = userState.currentPage === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => navigate(tab.key)}
                className="flex h-full flex-1 flex-col items-center justify-center gap-1 transition-transform duration-200 active:scale-[0.96]"
              >
                {uiStyle === 'scholar' && isActive ? (
                  <div className="px-3 py-1.5 rounded-full" style={{ backgroundColor: activeBg }}>
                    <Icon size={20} style={{ color: activeColor }} strokeWidth={2.5} />
                  </div>
                ) : (
                  <Icon
                    size={22}
                    style={{ color: isActive ? activeColor : '#64748b' }}
                    strokeWidth={isActive ? 2.5 : 1.9}
                  />
                )}
                <span
                  className="text-[11px] leading-tight"
                  style={{
                    color: isActive ? activeColor : '#64748b',
                    fontWeight: isActive ? 700 : 500,
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

  // ===== Scholar 风格（Fluid Scholar）=====
  if (uiStyle === 'scholar') {
    return (
      <nav
        className="fixed bottom-0 left-1/2 z-50 w-[min(100vw,430px)] -translate-x-1/2 h-[78px] border-t backdrop-blur-xl"
        style={{
          borderRadius: '1.75rem 1.75rem 0 0',
          backgroundColor: 'rgba(255,255,255,0.85)',
          borderColor: 'rgba(0,0,0,0.06)',
          boxShadow: '0 -8px 24px -4px rgba(15,23,42,0.06)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex h-full items-center justify-around px-4 pb-3 pt-2">
          {tabs.map(tab => {
            const isActive = userState.currentPage === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => navigate(tab.key)}
                className="flex h-full flex-1 flex-col items-center justify-center gap-1 transition-transform duration-200 active:scale-[0.96]"
              >
                {isActive ? (
                  <div
                    className="px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: layoutConfig.tabBarActiveBg || '#dee0ff' }}
                  >
                    <Icon size={20} style={{ color: layoutConfig.tabBarActiveColor || '#24389c' }} strokeWidth={2.5} />
                  </div>
                ) : (
                  <Icon size={22} style={{ color: theme.onSurfaceVariant || '#454652' }} strokeWidth={1.8} />
                )}
                <span
                  className="text-[11px] leading-tight"
                  style={{
                    color: isActive ? layoutConfig.tabBarActiveColor || '#24389c' : theme.onSurfaceVariant || '#454652',
                    fontWeight: isActive ? 700 : 500,
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
    <div className="fixed bottom-0 left-1/2 z-50 w-[min(100vw,430px)] -translate-x-1/2 safe-bottom">
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
