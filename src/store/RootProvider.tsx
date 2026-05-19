/**
 * ============================================================================
 * 根Provider - 组合所有Context Provider
 * ============================================================================
 */

import { type ReactNode } from 'react';
import { UserProvider } from './UserContext';
import { LearningProvider } from './LearningContext';
import { GameProvider } from './GameContext';
import { AIChatProvider } from './AIChatContext';
import { ThemeProvider } from './ThemeContext';
import AchievementWatcher from '@/components/system/AchievementWatcher';

export function RootProvider({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <ThemeProvider>
        <LearningProvider>
          <GameProvider>
            <AIChatProvider>
              <AchievementWatcher />
              {children}
            </AIChatProvider>
          </GameProvider>
        </LearningProvider>
      </ThemeProvider>
    </UserProvider>
  );
}
