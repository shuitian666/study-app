import { calculateLearningExperience, isAchievementConditionMet } from './achievementProgress';
import type { Achievement } from '@/types';

function achievement(type: Achievement['condition']['type'], value: number): Achievement {
  return {
    id: `ach-${type}`,
    name: type,
    description: type,
    icon: '⭐',
    category: 'learning',
    condition: { type, value },
    reward: { coins: 10 },
    unlocked: false,
    unlockedAt: null,
  };
}

describe('achievement progress', () => {
  test('experience is derived from learning activity, not star coins', () => {
    const experience = calculateLearningExperience(
      {
        knowledgePoints: [
          {
            id: 'kp-1',
            proficiency: 'master',
            studyRecords: [{ date: new Date().toISOString(), type: 'flashcard', score: 80, knowledgePointId: 'kp-1' }],
          },
        ] as any,
        quizResults: [{ totalQuestions: 5 }] as any,
      },
      { totalCheckins: 2 },
    );

    expect(experience).toBe(75);
  });

  test('clear wrong achievement requires previous mistakes and an empty wrong book', () => {
    const state = {
      knowledgePoints: [],
      quizResults: [{ score: 80 }],
      wrongRecords: [],
      todayReviewItems: [],
      todayNewItems: [],
    } as any;

    expect(isAchievementConditionMet(achievement('clear_wrong', 1), state, { records: [], streak: 0, totalCheckins: 0 })).toBe(true);
    expect(isAchievementConditionMet(
      achievement('clear_wrong', 1),
      { ...state, quizResults: [{ score: 100 }] },
      { records: [], streak: 0, totalCheckins: 0 },
    )).toBe(false);
  });
});
