import { generateTodayReviewPlan, calculateNewProficiency, getNextReviewDate } from './review';
import type { KnowledgePoint, ReviewItem, ProficiencyLevel } from '@/types';

function dayOffset(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function dateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function kp(overrides: Partial<KnowledgePoint>): KnowledgePoint {
  return {
    id: 'kp',
    subjectId: 'sub1',
    chapterId: 'chap1',
    name: 'Knowledge point',
    explanation: 'Explanation',
    proficiency: 'none',
    reviewCount: 0,
    lastReviewedAt: null,
    nextReviewAt: null,
    createdAt: dayOffset(0),
    source: 'manual',
    ...overrides,
  };
}

describe('daily review plan', () => {
  test('new account knowledge is planned as new, not review', () => {
    const points = [
      kp({ id: 'new-1', proficiency: 'none', reviewCount: 0, lastReviewedAt: null, nextReviewAt: null }),
      kp({ id: 'new-2', proficiency: 'none', reviewCount: 0, lastReviewedAt: null, nextReviewAt: dayOffset(-10) }),
    ];

    const { review, newItems } = generateTodayReviewPlan(points);

    expect(review).toHaveLength(0);
    expect(newItems.map(item => item.knowledgePointId)).toEqual(['new-1', 'new-2']);
  });

  test('only previously learned due cards enter review', () => {
    const points = [
      kp({ id: 'due', proficiency: 'normal', reviewCount: 2, lastReviewedAt: dayOffset(-8), nextReviewAt: dayOffset(-1) }),
      kp({ id: 'future', proficiency: 'normal', reviewCount: 2, lastReviewedAt: dayOffset(-1), nextReviewAt: dayOffset(3) }),
      kp({ id: 'unlearned-overdue', proficiency: 'none', reviewCount: 0, lastReviewedAt: null, nextReviewAt: dayOffset(-3) }),
    ];

    const { review, newItems } = generateTodayReviewPlan(points);

    expect(review.map(item => item.knowledgePointId)).toEqual(['due']);
    expect(newItems.map(item => item.knowledgePointId)).toEqual(['unlearned-overdue']);
  });

  test('completed new items are preserved when regenerating today plan', () => {
    const existingNewItems: ReviewItem[] = [
      {
        knowledgePointId: 'new-1',
        type: 'new',
        scheduledAt: dateKey(),
        completed: true,
      },
    ];

    const { newItems } = generateTodayReviewPlan(
      [kp({ id: 'new-1', reviewCount: 0, lastReviewedAt: null, nextReviewAt: null })],
      existingNewItems,
    );

    expect(newItems).toHaveLength(1);
    expect(newItems[0].completed).toBe(true);
  });
});

describe('spaced repetition helpers', () => {
  test('calculateNewProficiency increases on correct answer', () => {
    expect(calculateNewProficiency('none', true)).toBe('rusty');
    expect(calculateNewProficiency('rusty', true)).toBe('normal');
    expect(calculateNewProficiency('normal', true)).toBe('master');
    expect(calculateNewProficiency('master', true)).toBe('master');
  });

  test('calculateNewProficiency decreases on incorrect answer', () => {
    expect(calculateNewProficiency('master', false)).toBe('normal');
    expect(calculateNewProficiency('normal', false)).toBe('rusty');
    expect(calculateNewProficiency('rusty', false)).toBe('none');
    expect(calculateNewProficiency('none', false)).toBe('none');
  });

  test('getNextReviewDate follows proficiency intervals', () => {
    const dates = (['none', 'rusty', 'normal', 'master'] as ProficiencyLevel[])
      .map(level => new Date(getNextReviewDate(level)).getTime());

    expect(dates[0]).toBeLessThan(dates[1]);
    expect(dates[1]).toBeLessThan(dates[2]);
    expect(dates[2]).toBeLessThan(dates[3]);
    dates.forEach(time => expect(time).toBeGreaterThan(Date.now()));
  });
});
