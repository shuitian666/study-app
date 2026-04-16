/**
 * ============================================================================
 * iOS 风格设置列表 (Settings List)
 * ============================================================================
 *
 * 【功能】实现 iOS / Fluid Scholar 风格的设置列表组件
 *
 * 【使用场景】
 * - Profile 页面的菜单列表
 * - Settings 页面的设置项
 * - 激励中心的入口列表
 *
 * 【Fluid Scholar 风格特点】
 * - 圆角卡片容器 (rounded-lg)
 * - 每一行左侧有图标背景 (surfaceContainerLow)
 * - 右侧显示值或箭头
 * - 行之间用 hover 背景色区分
 * - 无分隔线，依靠背景色和间距区分
 * ============================================================================
 */

import React from 'react';
import { useTheme } from '@/store/ThemeContext';

interface SettingsRowItem {
  // 唯一键
  key: string;
  // 图标（React 组件或 emoji）
  icon?: React.ReactNode;
  // 图标颜色
  iconColor?: string;
  // 标签文字
  label: string;
  // 右侧显示的值
  value?: string | number;
  // 是否显示箭头
  showArrow?: boolean;
  // 徽章（如未读消息数）
  badge?: number;
  // 点击事件
  onClick?: () => void;
  // 自定义右侧内容
  rightContent?: React.ReactNode;
  // 是否是危险操作（如退出登录）
  isDanger?: boolean;
}

interface SettingsListProps {
  // 标题（如"应用设置"）
  title?: string;
  // 设置项数组
  items: SettingsRowItem[];
  // 自定义样式类
  className?: string;
  // 是否使用圆角卡片容器
  rounded?: boolean;
}

export default function SettingsList({
  title,
  items,
  className = '',
  rounded = true,
}: SettingsListProps) {
  const { theme } = useTheme();
  const uiStyle = theme.uiStyle || 'playful';

  // 获取图标容器背景色
  const getIconBg = (iconColor?: string): string => {
    if (!iconColor) return theme.surfaceContainerHigh || '#e7e8e9';

    // 根据图标颜色返回对应的浅色背景
    const colorMap: Record<string, string> = {
      'text-blue-500': '#dbeafe',
      'text-orange-500': '#ffedd5',
      'text-yellow-500': '#fef3c7',
      'text-purple-500': '#f3e8ff',
      'text-green-500': '#dcfce7',
      'text-red-500': '#fee2e2',
      'text-pink-500': '#fce7f3',
      'text-emerald-500': '#dcfce7',
      'text-rose-500': '#ffe4e6',
      'text-indigo-500': '#e0e7ff',
      'text-slate-500': '#f1f5f9',
    };

    return colorMap[iconColor] || theme.surfaceContainerHigh || '#e7e8e9';
  };

  // 渲染单个设置项
  const renderItem = (item: SettingsRowItem, index: number, totalItems: number) => {
    const isLast = index === totalItems - 1;

    return (
      <button
        key={item.key}
        onClick={item.onClick}
        className="w-full flex items-center justify-between px-4 py-3.5 transition-colors"
        style={{
          backgroundColor: 'transparent',
          borderBottom: isLast ? 'none' : `1px solid ${theme.outlineVariant || '#c5c5d4'}06`,
        }}
        onMouseEnter={(e) => {
          if (!item.isDanger) {
            e.currentTarget.style.backgroundColor = theme.surfaceContainerLow || '#f3f4f5';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <div className="flex items-center gap-3.5">
          {/* 图标 */}
          {item.icon && (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: getIconBg(item.iconColor) }}
            >
              <span style={{ color: item.iconColor?.replace('text-', '') }}>
                {item.icon}
              </span>
            </div>
          )}
          {/* 标签 */}
          <span
            className="text-sm font-medium"
            style={{ color: item.isDanger ? theme.error || '#ba1a1a' : theme.onSurface || '#191c1d' }}
          >
            {item.label}
          </span>
        </div>

        {/* 右侧内容 */}
        <div className="flex items-center gap-2">
          {item.rightContent || (
            <>
              {item.badge && item.badge > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    backgroundColor: theme.error || '#ba1a1a',
                    color: '#ffffff',
                  }}
                >
                  {item.badge}
                </span>
              )}
              {item.value && (
                <span className="text-sm" style={{ color: theme.onSurfaceVariant || '#454652' }}>
                  {item.value}
                </span>
              )}
              {item.showArrow !== false && (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={theme.onSurfaceVariant || '#454652'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-40"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </>
          )}
        </div>
      </button>
    );
  };

  // 元气风格返回简单的列表
  if (uiStyle === 'playful') {
    return (
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${className}`} style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
        {title && (
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
            <h3 className="font-semibold text-sm" style={{ color: theme.textPrimary }}>{title}</h3>
          </div>
        )}
        {items.map((item, index) => renderItem(item, index, items.length))}
      </div>
    );
  }

  // 学院风格使用圆角卡片容器
  return (
    <div className={className}>
      {title && (
        <h3
          className="text-xs font-bold uppercase tracking-[0.2em] px-2 mb-4"
          style={{ color: theme.onSurfaceVariant || '#454652' }}
        >
          {title}
        </h3>
      )}
      <div
        className="overflow-hidden"
        style={{
          backgroundColor: theme.surfaceContainerLowest || '#ffffff',
          borderRadius: rounded ? '16px' : '0',
          border: `1px solid ${theme.outlineVariant || '#c5c5d4'}10`,
        }}
      >
        {items.map((item, index) => renderItem(item, index, items.length))}
      </div>
    </div>
  );
}

// ========== 快捷操作按钮组件 ==========

interface QuickActionButtonProps {
  // 图标
  icon: React.ReactNode;
  // 图标颜色
  iconColor: string;
  // 标签
  label: string;
  // 点击事件
  onClick?: () => void;
  // 是否显示徽章
  badge?: number;
}

export function QuickActionButton({
  icon,
  iconColor,
  label,
  onClick,
  badge,
}: QuickActionButtonProps) {
  const { theme } = useTheme();

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
      style={{
        backgroundColor: theme.surfaceContainerLow || '#f3f4f5',
        borderRadius: theme.cardRadius || '12px',
        padding: theme.cardPadding || '16px',
        boxShadow: 'none',
        border: 'none',
      }}
    >
      <div className="relative">
        <span style={{ color: iconColor }}>{icon}</span>
        {badge && badge > 0 && (
          <span
            className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
            style={{
              backgroundColor: theme.error || '#ba1a1a',
              color: '#ffffff',
            }}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      <span className="text-[11px] font-medium" style={{ color: theme.onSurface || '#191c1d' }}>
        {label}
      </span>
    </button>
  );
}

// ========== Section Header 组件 ==========

interface SectionHeaderProps {
  title: string;
  actionText?: string;
  onActionClick?: () => void;
}

export function SectionHeader({
  title,
  actionText,
  onActionClick,
}: SectionHeaderProps) {
  const { theme } = useTheme();

  return (
    <div className="flex items-center justify-between mb-3">
      <h3
        className="font-semibold text-sm"
        style={{ color: theme.onSurface || '#191c1d' }}
      >
        {title}
      </h3>
      {actionText && (
        <button
          onClick={onActionClick}
          className="text-xs font-bold"
          style={{ color: theme.primary || '#24389c' }}
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
