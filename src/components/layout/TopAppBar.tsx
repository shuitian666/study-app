/**
 * ============================================================================
 * 顶部导航栏 (TopAppBar) - Fluid Scholar 风格
 * ============================================================================
 */

import React from 'react';
import { useUser } from '@/store/UserContext';
import { useTheme } from '@/store/ThemeContext';

interface TopAppBarProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  className?: string;
  showAvatar?: boolean;
}

export default function TopAppBar({
  title,
  subtitle,
  showBack = false,
  leftContent,
  rightContent,
  className = '',
  showAvatar = true,
}: TopAppBarProps) {
  const { navigate, userState } = useUser();
  const { theme } = useTheme();

  const uiStyle = theme.uiStyle || 'playful';

  if (uiStyle === 'playful') {
    return null;
  }

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate('home');
    }
  };

  const user = userState.user;
  const isCustomAvatar = user?.avatar?.startsWith('data:') || user?.avatar?.startsWith('http');

  return (
    <header
      className={`sticky top-0 z-50 ${className}`}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(197, 197, 212, 0.25)',
      }}
    >
      <div className="flex items-center justify-between w-full px-5 py-3.5">
        {/* 左侧区域 */}
        <div className="flex items-center gap-3">
          {showBack ? (
            <button
              onClick={handleBack}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors active:bg-gray-100"
              style={{ color: theme.onSurface || '#191c1d' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          ) : leftContent ? (
            leftContent
          ) : (
            <>
              {/* User avatar or Logo */}
              {showAvatar && user ? (
                <button
                  onClick={() => navigate('profile')}
                  className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center shrink-0"
                  style={{ backgroundColor: theme.surfaceContainerHigh || '#e7e8e9' }}
                >
                  {isCustomAvatar ? (
                    <img src={user.avatar} alt="头像" className="w-full h-full object-cover" />
                  ) : user.avatar ? (
                    <span className="text-lg">{user.avatar}</span>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.primary || '#24389c'} strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  )}
                </button>
              ) : (
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: theme.primary || '#24389c' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
                  </svg>
                </div>
              )}
              {/* Title */}
              <div>
                <span
                  className="font-extrabold text-[1.0625rem] tracking-tight"
                  style={{
                    color: theme.primary || '#24389c',
                    fontFamily: '"Plus Jakarta Sans", "Noto Sans SC", sans-serif',
                  }}
                >
                  {title || 'The Fluid Scholar'}
                </span>
                {subtitle && (
                  <p
                    className="text-[0.6875rem] font-semibold uppercase tracking-widest"
                    style={{ color: theme.onSurfaceVariant || '#454652', lineHeight: 1 }}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Title when showBack=true */}
          {showBack && title && (
            <span
              className="font-bold text-base"
              style={{ color: theme.onSurface || '#191c1d', fontFamily: '"Plus Jakarta Sans", "Noto Sans SC", sans-serif' }}
            >
              {title}
            </span>
          )}
        </div>

        {/* 右侧区域 */}
        <div className="flex items-center gap-1">
          {rightContent ?? (
            <button
              onClick={() => navigate('settings')}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors active:bg-gray-100"
              style={{ color: theme.textMuted || '#757684' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
