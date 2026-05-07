import { useEffect, useRef } from 'react';
import { useGame } from '@/store/GameContext';
import { useLearning } from '@/store/LearningContext';
import { useUser } from '@/store/UserContext';
import { isAchievementConditionMet } from '@/utils/achievementProgress';

export default function AchievementWatcher() {
  const { userState, userDispatch } = useUser();
  const { learningState } = useLearning();
  const { gameState, gameDispatch } = useGame();
  const pendingUnlockIds = useRef(new Set<string>());

  useEffect(() => {
    gameState.achievements.forEach(achievement => {
      if (achievement.unlocked) {
        pendingUnlockIds.current.delete(achievement.id);
      }
    });

    if (!userState.isLoggedIn || !userState.user) return;

    const newlyUnlocked = gameState.achievements.filter(
      achievement =>
        !achievement.unlocked
        && !pendingUnlockIds.current.has(achievement.id)
        && isAchievementConditionMet(achievement, learningState, gameState.checkin),
    );

    newlyUnlocked.forEach(achievement => {
      pendingUnlockIds.current.add(achievement.id);
      gameDispatch({ type: 'UNLOCK_ACHIEVEMENT', payload: achievement.id });
      if (achievement.reward.coins > 0) {
        userDispatch({ type: 'ADD_STAR_COINS', payload: achievement.reward.coins });
      }
    });
  }, [
    gameDispatch,
    gameState.achievements,
    gameState.checkin,
    learningState,
    userDispatch,
    userState.isLoggedIn,
    userState.user,
  ]);

  return null;
}
