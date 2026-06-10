import type { CheckinState, User } from '@/types';
import { calculateLearningExperience } from '@/utils/achievementProgress';
import { calculateLevelProgress } from '@/utils/experience';
import type { LearningState } from '@/store/LearningContext';

export const AI_STUDY_UNLOCK_LEVEL = 10;

export function getAIStudyLevelInfo(
  user: User | null,
  learningState: LearningState,
  checkin: CheckinState,
) {
  const totalExperience = calculateLearningExperience(learningState, checkin) + (user?.bonusExperience ?? 0);
  const levelProgress = calculateLevelProgress(totalExperience);
  return {
    totalExperience,
    levelProgress,
    unlocked: levelProgress.level >= AI_STUDY_UNLOCK_LEVEL,
  };
}
