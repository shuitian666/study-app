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
import { StudyTutorProvider } from './StudyTutorContext';
import { ThemeProvider } from './ThemeContext';
import AchievementWatcher from '@/components/system/AchievementWatcher';

export function RootProvider({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <ThemeProvider>
        <LearningProvider>
          <GameProvider>
            <AIChatProvider>
              <StudyTutorProvider>
                <AchievementWatcher />
                {children}
              </StudyTutorProvider>
            </AIChatProvider>
          </GameProvider>
        </LearningProvider>
      </ThemeProvider>
    </UserProvider>
  );
}
