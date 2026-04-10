/**
 * ============================================================================
 * 悬浮 AI 助手按钮 (Floating AI Panel)
 * ============================================================================
 *
 * 【功能】Fluid Scholar 风格的悬浮 AI 助手入口
 *
 * 【位置】固定在屏幕右下角，距底部 TabBar 约 100px
 *
 * 【Fluid Scholar 风格特点】
 * - 圆形按钮，使用 tertiary-fixed 背景色
 * - 带有 pulse 动画表示"活动状态"
 * - 点击展开 AI 面板或跳转 AI 聊天页面
 *
 * 【元气风格】
 * - 不显示此按钮，或以其他形式集成
 * ============================================================================
 */

import { useState } from 'react';
import { useUser } from '@/store/UserContext';
import { useTheme } from '@/store/ThemeContext';

interface FloatingAIPanelProps {
  // 点击事件
  onClick?: () => void;
}

export default function FloatingAIPanel({ onClick }: FloatingAIPanelProps) {
  const { navigate } = useUser();
  const { theme } = useTheme();
  const [isPressed, setIsPressed] = useState(false);

  // 判断当前 UI 风格
  const uiStyle = theme.uiStyle || 'playful';

  // 元气风格不显示此按钮
  if (uiStyle === 'playful') {
    return null;
  }

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate('ai-chat');
    }
  };

  return (
    <div className="fixed bottom-28 right-6 z-40">
      <button
        onClick={handleClick}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        onTouchStart={() => setIsPressed(true)}
        onTouchEnd={() => setIsPressed(false)}
        className="w-14 h-14 rounded-full flex items-center justify-center transition-all"
        style={{
          backgroundColor: theme.tertiaryFixed || '#fdd6ff',
          boxShadow: `0 8px 24px -4px rgba(115, 0, 142, 0.3)`,
          transform: isPressed ? 'scale(0.9)' : 'scale(1)',
          animation: 'pulse 2s infinite',
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke={theme.onTertiaryFixed || '#340042'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </button>

      {/* 脉冲动画 */}
      <style>{`
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(115, 0, 142, 0.4);
          }
          70% {
            box-shadow: 0 0 0 15px rgba(115, 0, 142, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(115, 0, 142, 0);
          }
        }
      `}</style>
    </div>
  );
}
