/**
 * ============================================================================
 * 顶部导航栏 (TopAppBar)
 * ============================================================================
 *
 * 【功能】Fluid Scholar 风格的顶部导航栏
 *
 * 【使用场景】
 * - Home 页面（替代原有的渐变头部）
 * - Profile 页面（替代原有的渐变头部）
 *
 * 【Fluid Scholar 风格特点】
 * - 白色半透明背景 + backdrop-blur
 * - 左侧：Logo + 应用名称 或 用户头像 + 标题
 * - 右侧：操作按钮（设置等）
 * - 底部可有细线分隔
 *
 * 【元气风格】
 * - 如果是 playful 风格，可以返回 null 让页面自行处理
 * ============================================================================
 */

import React from 'react';
import { useUser } from '@/store/UserContext';
import { useTheme } from '@/store/ThemeContext';

interface TopAppBarProps {
  // 标题
  title?: string;
  // 是否显示后退按钮
  showBack?: boolean;
  // 左侧自定义内容
  leftContent?: React.ReactNode;
  // 右侧自定义内容
  rightContent?: React.ReactNode;
  // 自定义样式
  className?: string;
}

export default function TopAppBar({
  title,
  showBack = false,
  leftContent,
  rightContent,
  className = '',
}: TopAppBarProps) {
  const { navigate } = useUser();
  const { theme } = useTheme();

  // 判断当前 UI 风格
  const uiStyle = theme.uiStyle || 'playful';

  // 元气风格不使用 TopAppBar，返回 null
  if (uiStyle === 'playful') {
    return null;
  }

  // 学院风格使用 TopAppBar
  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate('home');
    }
  };

  return (
    <header
      className={`sticky top-0 z-50 ${className}`}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex items-center justify-between w-full px-6 py-4">
        {/* 左侧区域 */}
        <div className="flex items-center gap-3">
          {showBack ? (
            <button
              onClick={handleBack}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              style={{
                backgroundColor: theme.surfaceContainerHigh || '#e7e8e9',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke={theme.onSurface || '#191c1d'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          ) : leftContent ? (
            leftContent
          ) : (
            <>
              {/* Logo */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: theme.surfaceContainerHigh || '#e7e8e9' }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={theme.primary || '#24389c'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
                </svg>
              </div>
              {/* 标题 */}
              <span
                className="text-lg font-bold"
                style={{
                  color: theme.primary || '#24389c',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                }}
              >
                {title || 'The Fluid Scholar'}
              </span>
            </>
          )}
        </div>

        {/* 右侧区域 */}
        <div className="flex items-center gap-2">
          {rightContent || (
            <button
              onClick={() => navigate('settings')}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              style={{
                backgroundColor: 'transparent',
                color: theme.textMuted || '#757684',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
