import React, { createContext, useContext, useMemo } from 'react';
import { useUser } from './UserContext';
import { getThemeByBackgroundId } from '@/types';

// 主题配置类型从 @/types 导入
import type { ThemeConfig } from '@/types';

const THEME_STYLE_KEY = 'study-app:theme-style';

function getStoredThemeStyle() {
  const saved = localStorage.getItem(THEME_STYLE_KEY);
  return saved === 'default' || saved === 'fluidScholar' ? saved : undefined;
}

interface ThemeContextType {
  theme: ThemeConfig;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userState } = useUser();
  const themeStyle = userState.user?.themeStyle ?? getStoredThemeStyle();

  // 根据当前背景ID和主题风格获取主题
  const theme = useMemo(() => {
    return getThemeByBackgroundId(userState.user?.background ?? undefined, themeStyle);
  }, [userState.user?.background, themeStyle]);

  // 判断是否为深色主题
  const isDark = useMemo(() => {
    // 如果是 Fluid Scholar 主题，根据背景的暗色程度判断
    if (themeStyle === 'fluidScholar') {
      // Fluid Scholar 主题整体偏亮，但不是纯白
      const bgColor = theme.bg;
      return bgColor.includes('#1a2656') || bgColor.includes('rgba(30, 30, 30');
    }
    // 基于主题的bg颜色判断是否为深色
    const bgColor = theme.bg;
    if (bgColor.startsWith('rgba')) {
      // 对于rgba颜色，检查alpha通道
      return true;
    }
    // 对于其他颜色，简单判断是否包含深色关键词
    return bgColor.includes('1e1b4b') || bgColor.includes('064e3b') || bgColor.includes('1e3a5f');
  }, [theme.bg, themeStyle]);

  return (
    <ThemeContext.Provider value={{ theme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};
