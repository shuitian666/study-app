import { calculateLearningExperience, isAchievementConditionMet, isUserAddedKnowledgePoint } from './achievementProgress';
import type { Achievement, KnowledgeSource } from '@/types';

type LearningExperienceState = Parameters<typeof calculateLearningExperience>[0];
type AchievementLearningState = Parameters<typeof isAchievementConditionMet>[1];

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

function knowledgePoint(id: string, source: KnowledgeSource) {
  return {
    id,
    source,
    proficiency: 'none',
    reviewCount: 0,
    studyRecords: [],
  };
}

function learningStateWithKnowledgePoints(knowledgePoints: ReturnType<typeof knowledgePoint>[]) {
  return {
    knowledgePoints,
    quizResults: [],
    wrongRecords: [],
    todayReviewItems: [],
    todayNewItems: [],
  } as unknown as AchievementLearningState;
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
        ] as unknown as LearningExperienceState['knowledgePoints'],
        quizResults: [{ totalQuestions: 5, completedAt: new Date().toISOString() }] as unknown as LearningExperienceState['quizResults'],
      },
      { totalCheckins: 2 },
    );

    expect(experience).toBe(18);
  });

  test('daily learning experience is capped at 200', () => {
    const today = new Date().toISOString();
    const experience = calculateLearningExperience(
      {
        knowledgePoints: [
          {
            id: 'kp-1',
            proficiency: 'none',
            studyRecords: Array.from({ length: 100 }, (_, index) => ({
              date: today,
              type: 'flashcard',
              score: 80,
              knowledgePointId: `kp-${index}`,
            })),
            quizRecords: [],
          },
        ] as unknown as LearningExperienceState['knowledgePoints'],
        quizResults: [{ totalQuestions: 100, completedAt: today }] as unknown as LearningExperienceState['quizResults'],
      },
      { totalCheckins: 0 },
    );

    expect(experience).toBe(200);
  });

  test('clear wrong achievement requires previous mistakes and an empty wrong book', () => {
    const state = {
      knowledgePoints: [],
      quizResults: [{ score: 80 }],
      wrongRecords: [],
      todayReviewItems: [],
      todayNewItems: [],
    } as unknown as AchievementLearningState;

    expect(isAchievementConditionMet(achievement('clear_wrong', 1), state, { records: [], streak: 0, totalCheckins: 0 })).toBe(true);
    expect(isAchievementConditionMet(
      achievement('clear_wrong', 1),
      { ...state, quizResults: [{ score: 100 }] },
      { records: [], streak: 0, totalCheckins: 0 },
    )).toBe(false);
  });

  test('built-in import knowledge points do not satisfy total knowledge achievements', () => {
    const state = learningStateWithKnowledgePoints(
      Array.from({ length: 100 }, (_, index) => knowledgePoint(`kp-${index + 1}`, 'import')),
    );

    expect(isAchievementConditionMet(
      achievement('total_knowledge', 100),
      state,
      { records: [], streak: 0, totalCheckins: 0 },
    )).toBe(false);
  });

  test('total knowledge achievements count only user-added knowledge points', () => {
    const userAddedKnowledgePoints = [
      ...Array.from({ length: 33 }, (_, index) => knowledgePoint(`kp-manual-${index + 1}`, 'manual')),
      ...Array.from({ length: 33 }, (_, index) => knowledgePoint(`kp-ai-${index + 1}`, 'ai')),
      ...Array.from({ length: 34 }, (_, index) => knowledgePoint(`kp-import-${index + 1}`, 'import')),
    ];

    expect(isAchievementConditionMet(
      achievement('total_knowledge', 100),
      learningStateWithKnowledgePoints(userAddedKnowledgePoints.slice(0, 99)),
      { records: [], streak: 0, totalCheckins: 0 },
    )).toBe(false);
    expect(isAchievementConditionMet(
      achievement('total_knowledge', 100),
      learningStateWithKnowledgePoints(userAddedKnowledgePoints),
      { records: [], streak: 0, totalCheckins: 0 },
    )).toBe(true);
  });

  test('user-added knowledge predicate excludes ordinary imported ids', () => {
    expect(isUserAddedKnowledgePoint(knowledgePoint('kp-manual-1', 'manual'))).toBe(true);
    expect(isUserAddedKnowledgePoint(knowledgePoint('kp-ai-1', 'ai'))).toBe(true);
    expect(isUserAddedKnowledgePoint(knowledgePoint('kp-import-1', 'import'))).toBe(true);
    expect(isUserAddedKnowledgePoint(knowledgePoint('kp-1', 'import'))).toBe(false);
    expect(isUserAddedKnowledgePoint(knowledgePoint('cloud-kp-1', 'import'))).toBe(false);
  });
});
