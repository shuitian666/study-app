/**
 * ============================================================================
 * 根Provider - 组合所有Context Provider
 * ============================================================================
 */

import { type ReactNode } from 'react';
import { UserProvider } from './UserContext';
import { AppProvider } from './AppContext';
import { LearningProvider } from './LearningContext';
import { GameProvider } from './GameContext';
import { AIChatProvider } from './AIChatContext';
import { ThemeProvider } from './ThemeContext';

export function RootProvider({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <ThemeProvider>
        <AppProvider>
          <LearningProvider>
            <GameProvider>
              <AIChatProvider>
                {children}
              </AIChatProvider>
            </GameProvider>
          </LearningProvider>
        </AppProvider>
      </ThemeProvider>
    </UserProvider>
  );
}
