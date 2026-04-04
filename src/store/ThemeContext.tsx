import React, { createContext, useContext, useMemo } from 'react';
import { useUser } from './UserContext';
import { getThemeByBackgroundId } from '@/types';

// 主题配置类型从 @/types 导入
import type { ThemeConfig } from '@/types';

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
  
  // 根据当前背景ID获取主题
  const theme = useMemo(() => {
    return getThemeByBackgroundId(userState.user?.background ?? undefined);
  }, [userState.user?.background]);
  
  // 判断是否为深色主题
  const isDark = useMemo(() => {
    // 基于主题的bg颜色判断是否为深色
    const bgColor = theme.bg;
    if (bgColor.startsWith('rgba')) {
      // 对于rgba颜色，检查alpha通道
      return true;
    }
    // 对于其他颜色，简单判断是否包含深色关键词
    return bgColor.includes('1e1b4b') || bgColor.includes('064e3b') || bgColor.includes('1e3a5f');
  }, [theme.bg]);
  
  return (
    <ThemeContext.Provider value={{ theme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};
