import React, { useEffect } from 'react';
import { useTheme } from '@/store/ThemeContext';

// 将主题配置转换为CSS变量对象
export const themeToCSSVariables = (theme: any) => {
  const variables: Record<string, string> = {};
  
  // 主要颜色
  variables['--color-primary'] = theme.primary;
  variables['--color-primary-light'] = theme.primaryLight;
  variables['--color-primary-dark'] = theme.primaryDark;
  
  // 辅助颜色
  variables['--color-secondary'] = theme.secondary;
  variables['--color-secondary-light'] = theme.secondaryLight;
  
  // 功能颜色
  variables['--color-accent'] = theme.accent;
  variables['--color-accent-light'] = theme.accentLight;
  variables['--color-danger'] = theme.danger;
  variables['--color-warning'] = theme.warning;
  variables['--color-success'] = theme.success;
  
  // 背景颜色
  variables['--color-bg'] = theme.bg;
  variables['--color-bg-card'] = theme.bgCard;
  
  // 文本颜色
  variables['--color-text-primary'] = theme.textPrimary;
  variables['--color-text-secondary'] = theme.textSecondary;
  variables['--color-text-muted'] = theme.textMuted;
  
  // 边框颜色
  variables['--color-border'] = theme.border;
  
  // 掌握度颜色
  variables['--color-prof-none'] = theme.profNone;
  variables['--color-prof-rusty'] = theme.profRusty;
  variables['--color-prof-normal'] = theme.profNormal;
  variables['--color-prof-master'] = theme.profMaster;
  
  return variables;
};

// 主题样式应用组件
export const ThemeStyles: React.FC = () => {
  const { theme } = useTheme();
  
  useEffect(() => {
    // 获取根元素
    const root = document.documentElement;
    
    // 转换主题为CSS变量
    const cssVariables = themeToCSSVariables(theme);
    
    // 应用CSS变量到根元素
    Object.entries(cssVariables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [theme]);
  
  return null;
};
