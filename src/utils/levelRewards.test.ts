import { getRequiredTotalExpForLevel } from './experience';
import { detectLevelUpTransition } from './levelRewards';

describe('level rewards', () => {
  test('detects crossing from level nine to level ten', () => {
    const levelNineExperience = getRequiredTotalExpForLevel(9);
    const levelTenExperience = getRequiredTotalExpForLevel(10);

    const transition = detectLevelUpTransition(levelNineExperience, levelTenExperience);

    expect(transition?.previousLevel).toBe(9);
    expect(transition?.nextLevel).toBe(10);
    expect(transition?.rewards).toHaveLength(1);
    expect(transition?.rewards[0].rewardName).toBe('AI 学习探索者');
  });

  test('does not report a transition while staying below level ten', () => {
    const before = getRequiredTotalExpForLevel(5);
    const after = getRequiredTotalExpForLevel(5) + 12;

    expect(detectLevelUpTransition(before, after)).toBeNull();
  });

  test('keeps account sync from creating a transition without an experience increase', () => {
    const experience = getRequiredTotalExpForLevel(10);

    expect(detectLevelUpTransition(experience, experience)).toBeNull();
  });
});
