import React, { useEffect } from 'react';
import { useTheme } from '@/store/ThemeContext';

// 将主题配置转换为CSS变量对象
export const themeToCSSVariables = (theme: any) => {
  const variables: Record<string, string> = {};

  // ========== 颜色 ==========
  // 主要颜色
  variables['--color-primary-var'] = theme.primary;
  variables['--color-primary-light-var'] = theme.primaryLight;
  variables['--color-primary-dark-var'] = theme.primaryDark;

  // 辅助颜色
  variables['--color-secondary-var'] = theme.secondary;
  variables['--color-secondary-light-var'] = theme.secondaryLight;

  // 功能颜色
  variables['--color-accent-var'] = theme.accent;
  variables['--color-accent-light-var'] = theme.accentLight;
  variables['--color-danger-var'] = theme.danger;
  variables['--color-warning-var'] = theme.warning;
  variables['--color-success-var'] = theme.success;

  // 背景颜色
  variables['--color-bg-var'] = theme.bg;
  variables['--color-bg-card-var'] = theme.bgCard;

  // 文本颜色
  variables['--color-text-primary-var'] = theme.textPrimary;
  variables['--color-text-secondary-var'] = theme.textSecondary;
  variables['--color-text-muted-var'] = theme.textMuted;

  // 边框颜色
  variables['--color-border-var'] = theme.border;

  // 掌握度颜色
  variables['--color-prof-none-var'] = theme.profNone;
  variables['--color-prof-rusty-var'] = theme.profRusty;
  variables['--color-prof-normal-var'] = theme.profNormal;
  variables['--color-prof-master-var'] = theme.profMaster;

  // Surface 层级颜色
  variables['--color-surface-var'] = theme.surface || theme.bg || '#f8f9fa';
  variables['--color-surface-container-low-var'] = theme.surfaceContainerLow || '#f3f4f5';
  variables['--color-surface-container-high-var'] = theme.surfaceContainerHigh || '#e7e8e9';
  variables['--color-surface-container-highest-var'] = theme.surfaceContainerHighest || '#e1e3e4';
  variables['--color-surface-container-lowest-var'] = theme.surfaceContainerLowest || '#ffffff';
  variables['--color-on-surface-var'] = theme.onSurface || '#191c1d';
  variables['--color-on-surface-variant-var'] = theme.onSurfaceVariant || '#454652';
  variables['--color-outline-variant-var'] = theme.outlineVariant || '#c5c5d4';
  variables['--color-tertiary-var'] = theme.tertiary || '#73008e';
  variables['--color-tertiary-container-var'] = theme.tertiaryContainer || '#9026ac';
  variables['--color-tertiary-fixed-var'] = theme.tertiaryFixed || '#fdd6ff';
  variables['--color-primary-fixed-var'] = theme.primaryFixed || '#dee0ff';
  variables['--color-secondary-fixed-var'] = theme.secondaryFixed || '#ffdfa0';

  // ========== Fluid Scholar 语义化颜色 ==========
  if (theme.isFluidScholar) {
    // Primary
    variables['--primary'] = theme.primary || '#24389c';
    variables['--primary-container'] = theme.primaryContainer || '#3f51b5';
    variables['--on-primary'] = theme.onPrimary || '#ffffff';
    variables['--on-primary-container'] = theme.onPrimaryContainer || '#cacfff';
    variables['--primary-fixed'] = theme.primaryFixed || '#dee0ff';
    variables['--inverse-primary'] = theme.inversePrimary || '#bac3ff';

    // Secondary
    variables['--secondary'] = theme.secondary || '#795900';
    variables['--secondary-container'] = theme.secondaryContainer || '#ffbf00';
    variables['--on-secondary'] = theme.onSecondary || '#ffffff';
    variables['--secondary-fixed'] = theme.secondaryFixed || '#ffdfa0';
    variables['--on-secondary-fixed'] = theme.onSecondaryFixed || '#261a00';

    // Tertiary
    variables['--tertiary'] = theme.tertiary || '#73008e';
    variables['--tertiary-container'] = theme.tertiaryContainer || '#9026ac';
    variables['--on-tertiary'] = theme.onTertiary || '#ffffff';
    variables['--tertiary-fixed'] = theme.tertiaryFixed || '#fdd6ff';

    // Error
    variables['--error'] = theme.error || '#ba1a1a';
    variables['--error-container'] = theme.errorContainer || '#ffdad6';
    variables['--on-error'] = theme.onError || '#ffffff';

    // Surface
    variables['--surface'] = theme.surface || '#f8f9fa';
    variables['--surface-container-low'] = theme.surfaceContainerLow || '#f3f4f5';
    variables['--surface-container'] = theme.surfaceContainer || '#edeeef';
    variables['--surface-container-high'] = theme.surfaceContainerHigh || '#e7e8e9';
    variables['--surface-container-highest'] = theme.surfaceContainerHighest || '#e1e3e4';
    variables['--surface-container-lowest'] = theme.surfaceContainerLowest || '#ffffff';
    variables['--on-surface'] = theme.onSurface || '#191c1d';
    variables['--on-surface-variant'] = theme.onSurfaceVariant || '#454652';
    variables['--outline'] = theme.outline || '#757684';
    variables['--outline-variant'] = theme.outlineVariant || '#c5c5d4';

    // Background
    variables['--background'] = theme.background || theme.bg || '#f8f9fa';
    variables['--on-background'] = theme.onBackground || theme.textPrimary || '#191c1d';
  }

  // ========== 布局变量 ==========
  // 页面内边距
  variables['--page-padding'] = theme.pagePadding || '16px';
  // 卡片内边距
  variables['--card-padding'] = theme.cardPadding || '16px';
  // 卡片圆角
  variables['--card-radius'] = theme.cardRadius || '12px';
  // 卡片阴影
  variables['--card-shadow'] = theme.cardShadow || 'none';
  // 按钮圆角
  variables['--button-radius'] = theme.buttonRadius || '12px';
  // 组件间距
  variables['--gap-sm'] = theme.gapSm || '8px';
  variables['--gap-md'] = theme.gapMd || '16px';
  variables['--gap-lg'] = theme.gapLg || '24px';
  // Section 间距
  variables['--section-gap'] = theme.sectionGap || '24px';

  return variables;
};

// 主题样式应用组件
export const ThemeStyles: React.FC = () => {
  const { theme } = useTheme();

  useEffect(() => {
    const root = document.documentElement;

    // 转换主题为CSS变量
    const cssVariables = themeToCSSVariables(theme);

    // 应用CSS变量到根元素
    Object.entries(cssVariables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // 设置 data-theme 属性用于 CSS 选择器
    if (theme.isFluidScholar) {
      root.setAttribute('data-theme', 'fluidScholar');
    } else {
      root.removeAttribute('data-theme');
    }
  }, [theme]);

  return null;
};
