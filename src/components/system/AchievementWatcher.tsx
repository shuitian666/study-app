import { useEffect, useRef, useState } from 'react';
import { useGame } from '@/store/GameContext';
import { useLearning } from '@/store/LearningContext';
import { useUser } from '@/store/UserContext';
import { isAchievementConditionMet } from '@/utils/achievementProgress';
import { STUDY_EXPERIENCE_EVENT } from '@/utils/levelRewards';

export default function AchievementWatcher() {
  const { userState, userDispatch } = useUser();
  const { learningState } = useLearning();
  const { gameState, gameDispatch } = useGame();
  const pendingUnlockIds = useRef(new Set<string>());
  const processedStudyEventCount = useRef(0);
  const [studyEventCount, setStudyEventCount] = useState(0);

  useEffect(() => {
    const timers = new Set<number>();
    const handleStudyExperience = () => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        setStudyEventCount(count => count + 1);
      }, 80);
      timers.add(timer);
    };
    window.addEventListener(STUDY_EXPERIENCE_EVENT, handleStudyExperience);
    return () => {
      window.removeEventListener(STUDY_EXPERIENCE_EVENT, handleStudyExperience);
      timers.forEach(timer => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    gameState.achievements.forEach(achievement => {
      if (achievement.unlocked) {
        pendingUnlockIds.current.delete(achievement.id);
      }
    });

    if (
      !userState.isLoggedIn
      || !userState.user
      || studyEventCount === 0
      || processedStudyEventCount.current >= studyEventCount
    ) {
      return;
    }
    processedStudyEventCount.current = studyEventCount;

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
    studyEventCount,
    userDispatch,
    userState.isLoggedIn,
    userState.user,
  ]);

  return null;
}
