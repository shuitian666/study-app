/**
 * ============================================================================
 * Bento Grid 布局组件
 * ============================================================================
 *
 * 【功能】实现 Fluid Scholar 设计系统中的不对称 Bento Grid 布局
 *
 * 【使用场景】
 * - Home 页面的今日任务、统计、快捷入口区域
 * - Dashboard 页面
 *
 * 【Bento Grid 布局规则】
 * - 2列基础网格，可以合并成不对称布局
 * - 典型布局：
 *   ┌─────┬─────┐
 *   │  1  │  1  │  (两个等宽)
 *   ├─────┼─────┤
 *   │  2  │     │  (左侧2倍宽)
 *   │     │     │
 *   └─────┴─────┘
 *
 * 【Fluid Scholar 风格特点】
 * - 使用 surface-container-lowest 作为卡片背景
 * - 无阴影，依靠背景色区分层级
 * - 圆角使用 rounded-lg (2rem)
 * - 卡片之间使用 gap 分隔
 * ============================================================================
 */

import React from 'react';
import { useTheme } from '@/store/ThemeContext';
import { UILAYOUT_CONFIGS } from '@/types';

interface BentoItem {
  // 唯一键
  key: string;
  // 占据的列数 (1 或 2)
  colSpan?: 1 | 2;
  // 占据的行数 (默认1)
  rowSpan?: number;
  // 自定义样式类
  className?: string;
  // 内容
  children: React.ReactNode;
  // 点击事件
  onClick?: () => void;
}

interface BentoGridProps {
  // Bento 项目数组
  items: BentoItem[];
  // 列数，默认2
  columns?: 2 | 3 | 4;
  // 间距
  gap?: string;
  // 自定义样式类
  className?: string;
}

export default function BentoGrid({
  items,
  columns = 2,
  gap,
  className = '',
}: BentoGridProps) {
  const { theme } = useTheme();
  const uiStyle = theme.uiStyle || 'playful';
  const layoutConfig = UILAYOUT_CONFIGS[uiStyle];

  // 默认间距
  const defaultGap = gap || theme.gapMd || '16px';

  // 根据 UI 风格设置卡片样式
  const getCardStyle = (): React.CSSProperties => {
    if (layoutConfig.cardStyle === 'surface') {
      return {
        backgroundColor: theme.surfaceContainerLowest || theme.bgCard || '#ffffff',
        borderRadius: '16px',
        boxShadow: 'none',
        border: 'none',
      };
    }
    return {
      backgroundColor: theme.bgCard || '#ffffff',
      borderRadius: theme.cardRadius || '12px',
      boxShadow: theme.cardShadow !== 'none' ? '0 4px 12px -2px rgba(0, 0, 0, 0.1)' : 'none',
      border: `1px solid ${theme.border}`,
    };
  };

  return (
    <div
      className={`grid ${className}`}
      style={{
        gridTemplateColumns: columns === 2 ? 'repeat(2, 1fr)' : `repeat(${columns}, 1fr)`,
        gap: defaultGap,
      }}
    >
      {items.map((item) => (
        <div
          key={item.key}
          className={item.className}
          onClick={item.onClick}
          style={{
            ...getCardStyle(),
            gridColumn: item.colSpan === 2 ? 'span 2' : 'span 1',
            gridRow: item.rowSpan ? `span ${item.rowSpan}` : 'span 1',
            padding: theme.cardPadding || '16px',
            cursor: item.onClick ? 'pointer' : 'auto',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
        >
          {item.children}
        </div>
      ))}
    </div>
  );
}

// ========== 预设的 Bento 卡片布局 ==========

// 学习任务卡片（今日任务）
interface LearningTaskCardProps {
  reviewPending: number;
  completedNew: number;
  dailyNewGoal: number;
  freeLearningMode: boolean;
  onReviewClick: () => void;
  onStartClick: () => void;
}

export function LearningTaskBento({
  reviewPending,
  completedNew,
  dailyNewGoal,
  freeLearningMode,
  onReviewClick,
  onStartClick,
}: LearningTaskCardProps) {
  const { theme } = useTheme();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-1.5">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={theme.primary}
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
          今日学习任务
        </h3>
        <span className="text-xs" style={{ color: theme.textMuted }}>
          {reviewPending > 0
            ? '复习中'
            : freeLearningMode
              ? '目标完成'
              : '新学中'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* 待复习 */}
        <button
          onClick={reviewPending > 0 ? onReviewClick : undefined}
          className="text-left transition-transform active:scale-[0.97]"
          style={{
            background:
              reviewPending > 0
                ? theme.surfaceContainerLow || `${theme.secondary}10`
                : theme.surfaceContainerLowest || theme.bgCard,
            borderRadius: '12px',
            padding: '16px',
            border: 'none',
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={reviewPending > 0 ? theme.secondary : theme.textMuted}
              strokeWidth="2"
            >
              <path d="M12 8v4l3 3" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            <span
              className="text-xs font-medium"
              style={{ color: reviewPending > 0 ? theme.secondary : theme.textMuted }}
            >
              待复习
            </span>
          </div>
          <div
            className="text-2xl font-bold"
            style={{ color: reviewPending > 0 ? theme.secondary : theme.textMuted }}
          >
            {reviewPending}
          </div>
          <div
            className="text-[10px] mt-0.5"
            style={{ color: reviewPending > 0 ? theme.secondaryLight : theme.textMuted }}
          >
            个知识点
          </div>
        </button>

        {/* 开始学习 */}
        <button
          onClick={onStartClick}
          className="text-left transition-transform active:scale-[0.97]"
          style={{
            background:
              freeLearningMode
                ? `${theme.success}10`
                : reviewPending > 0 || completedNew < dailyNewGoal
                  ? `${theme.primary}10`
                  : `${theme.success}10`,
            borderRadius: '12px',
            padding: '16px',
            border: 'none',
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            {freeLearningMode ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={theme.success}
                strokeWidth="2"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={theme.primary}
                strokeWidth="2"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
            <span
              className="text-xs font-medium"
              style={{ color: freeLearningMode ? theme.success : theme.primary }}
            >
              {freeLearningMode ? '自由学习' : '开始学习'}
            </span>
          </div>
          <div
            className="text-2xl font-bold"
            style={{ color: freeLearningMode ? theme.success : theme.primary }}
          >
            {freeLearningMode ? '🎉' : reviewPending > 0 ? `${reviewPending}` : `${completedNew}/${dailyNewGoal}`}
          </div>
          <div
            className="text-[10px] mt-0.5"
            style={{ color: freeLearningMode ? theme.accent : theme.primaryLight }}
          >
            {freeLearningMode
              ? '目标已完成'
              : reviewPending > 0
                ? `复习 + ${dailyNewGoal}新学`
                : `新学 ${completedNew}/${dailyNewGoal}`}
          </div>
        </button>
      </div>
    </div>
  );
}

// 统计数据卡片
interface StatsBentoCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconColor?: string;
  trend?: string;
  colSpan?: 1 | 2;
}

export function StatsBentoCard({
  title,
  value,
  subtitle,
  icon,
  iconColor: _iconColor,
  trend,
  colSpan = 1,
}: StatsBentoCardProps) {
  const { theme } = useTheme();

  return (
    <div
      className="flex flex-col justify-between h-44"
      style={{
        gridColumn: colSpan === 2 ? 'span 2' : 'span 1',
      }}
    >
      <div className="flex justify-between items-start">
        <div
          className="p-2 rounded-xl"
          style={{ backgroundColor: theme.primaryFixed || '#dee0ff' }}
        >
          <span style={{ color: theme.primary }}>{icon}</span>
        </div>
        {trend && (
          <span
            className="text-xs font-bold"
            style={{ color: theme.success || '#10b981' }}
          >
            {trend}
          </span>
        )}
      </div>
      <div>
        <div
          className="text-2xl font-black"
          style={{
            color: theme.onSurface || '#191c1d',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}
        >
          {value}
        </div>
        <div
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: theme.onSurfaceVariant || '#454652' }}
        >
          {title}
        </div>
        {subtitle && (
          <div className="text-[10px] mt-0.5" style={{ color: theme.textMuted }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

// AI Tutor Banner
interface AIBannerBentoProps {
  title: string;
  description: string;
  buttonText: string;
  onButtonClick: () => void;
  colSpan?: 1 | 2;
}

export function AIBannerBento({
  title,
  description,
  buttonText,
  onButtonClick,
  colSpan = 2,
}: AIBannerBentoProps) {
  const { theme } = useTheme();

  return (
    <div
      className="relative overflow-hidden"
      style={{
        gridColumn: colSpan === 2 ? 'span 2' : 'span 1',
        background: `linear-gradient(135deg, ${theme.primary}, ${theme.tertiary || '#73008e'})`,
        borderRadius: '16px',
        padding: '24px',
      }}
    >
      {/* 装饰圆形 */}
      <div
        className="absolute top-0 right-0 w-32 h-32 opacity-20 rounded-full blur-3xl"
        style={{ backgroundColor: theme.secondaryContainer || '#ffbf00', transform: 'translate(30%, -30%)' }}
      />

      <div className="relative z-10 flex items-center justify-between">
        <div className="max-w-[60%]">
          <h3
            className="text-white font-bold text-lg leading-tight"
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            {title}
          </h3>
          <p className="text-sm mt-1 opacity-90" style={{ color: theme.primaryFixed || '#dee0ff' }}>
            {description}
          </p>
          <button
            onClick={onButtonClick}
            className="mt-4 px-6 py-2 rounded-full text-sm font-bold active:scale-95 transition-transform"
            style={{
              backgroundColor: '#ffffff',
              color: theme.primary,
            }}
          >
            {buttonText}
          </button>
        </div>
        <div
          className="p-4 rounded-full"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
      </div>
    </div>
  );
}
