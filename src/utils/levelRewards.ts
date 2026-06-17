import { calculateLevelProgress } from './experience';

export const STUDY_EXPERIENCE_EVENT = 'study-app:study-experience-earned';
export const LEVEL_10_REWARD_TITLE = 'AI 学习探索者';

export type StudyExperienceSource = 'flashcard' | 'quiz' | 'checkin' | 'makeup_checkin';

export interface StudyExperienceEventDetail {
  source: StudyExperienceSource;
}

export interface MilestoneLevelReward {
  level: number;
  title: string;
  description: string;
  rewardName: string;
  rewardType: 'title';
  rewardRarity: 'SR';
  icon: string;
}

export interface LevelUpTransition {
  previousLevel: number;
  nextLevel: number;
  rewards: MilestoneLevelReward[];
}

export const MILESTONE_LEVEL_REWARDS: MilestoneLevelReward[] = [
  {
    level: 10,
    title: 'AI 学习已解锁',
    description: '可以开始使用规划式 AI 学习，自动规划、讲解、练习和总结。',
    rewardName: LEVEL_10_REWARD_TITLE,
    rewardType: 'title',
    rewardRarity: 'SR',
    icon: '✦',
  },
];

export function getMilestoneLevelReward(level: number) {
  return MILESTONE_LEVEL_REWARDS.find(reward => reward.level === level) ?? null;
}

export function detectLevelUpTransition(previousExperience: number, nextExperience: number): LevelUpTransition | null {
  const previousLevel = calculateLevelProgress(previousExperience).level;
  const nextLevel = calculateLevelProgress(nextExperience).level;
  if (nextLevel <= previousLevel) return null;

  return {
    previousLevel,
    nextLevel,
    rewards: MILESTONE_LEVEL_REWARDS.filter(reward => reward.level > previousLevel && reward.level <= nextLevel),
  };
}

export function notifyStudyExperienceEarned(source: StudyExperienceSource) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<StudyExperienceEventDetail>(STUDY_EXPERIENCE_EVENT, {
    detail: { source },
  }));
}
