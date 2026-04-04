import { generateTodayReviewPlan, calculateNewProficiency, getNextReviewDate } from './review';
import type { KnowledgePoint, ReviewItem, ProficiencyLevel } from '@/types';

// 测试间隔重复算法
describe('Spaced Repetition Algorithm', () => {
  // 模拟知识点数据
  const mockKnowledgePoints: KnowledgePoint[] = [
    // 新学知识点
    {
      id: 'kp1',
      subjectId: 'sub1',
      chapterId: 'chap1',
      content: '知识点1',
      proficiency: 'none' as ProficiencyLevel,
      reviewCount: 0,
      lastReviewedAt: null,
      nextReviewAt: null,
      createdAt: new Date().toISOString(),
    },
    // 需要复习的知识点（nextReviewAt <= 今天）
    {
      id: 'kp2',
      subjectId: 'sub1',
      chapterId: 'chap1',
      content: '知识点2',
      proficiency: 'normal' as ProficiencyLevel,
      reviewCount: 2,
      lastReviewedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      nextReviewAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    },
    // 不需要复习的知识点（nextReviewAt > 今天）
    {
      id: 'kp3',
      subjectId: 'sub1',
      chapterId: 'chap1',
      content: '知识点3',
      proficiency: 'master' as ProficiencyLevel,
      reviewCount: 5,
      lastReviewedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      nextReviewAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    },
    // 已学习但未达到复习时间的知识点
    {
      id: 'kp4',
      subjectId: 'sub1',
      chapterId: 'chap1',
      content: '知识点4',
      proficiency: 'rusty' as ProficiencyLevel,
      reviewCount: 1,
      lastReviewedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      nextReviewAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    },
  ];

  test('generateTodayReviewPlan should generate correct review and new items', () => {
    const { review, newItems } = generateTodayReviewPlan(mockKnowledgePoints);
    
    // 验证新学项目
    expect(newItems).toHaveLength(1);
    expect(newItems[0].knowledgePointId).toBe('kp1');
    expect(newItems[0].type).toBe('new');
    
    // 验证复习项目
    expect(review).toHaveLength(1);
    expect(review[0].knowledgePointId).toBe('kp2');
    expect(review[0].type).toBe('review');
  });

  test('generateTodayReviewPlan should preserve existing new items', () => {
    const existingNewItems: ReviewItem[] = [
      {
        knowledgePointId: 'kp1',
        type: 'new',
        scheduledAt: new Date().toISOString().slice(0, 10),
        completed: true,
      },
    ];
    
    const { review, newItems } = generateTodayReviewPlan(mockKnowledgePoints, existingNewItems);
    
    // 验证已存在的新学项目被保留，且状态正确
    expect(newItems).toHaveLength(1);
    expect(newItems[0].knowledgePointId).toBe('kp1');
    expect(newItems[0].completed).toBe(true);
  });

  test('calculateNewProficiency should increase proficiency on correct answer', () => {
    expect(calculateNewProficiency('none', true)).toBe('rusty');
    expect(calculateNewProficiency('rusty', true)).toBe('normal');
    expect(calculateNewProficiency('normal', true)).toBe('master');
    expect(calculateNewProficiency('master', true)).toBe('master'); // 最高级别
  });

  test('calculateNewProficiency should decrease proficiency on incorrect answer', () => {
    expect(calculateNewProficiency('master', false)).toBe('normal');
    expect(calculateNewProficiency('normal', false)).toBe('rusty');
    expect(calculateNewProficiency('rusty', false)).toBe('none');
    expect(calculateNewProficiency('none', false)).toBe('none'); // 最低级别
  });

  test('getNextReviewDate should return correct date based on proficiency', () => {
    const date1 = new Date(getNextReviewDate('none'));
    const date2 = new Date(getNextReviewDate('rusty'));
    const date3 = new Date(getNextReviewDate('normal'));
    const date4 = new Date(getNextReviewDate('master'));
    
    // 验证日期顺序：none < rusty < normal < master
    expect(date1 < date2).toBe(true);
    expect(date2 < date3).toBe(true);
    expect(date3 < date4).toBe(true);
    
    // 验证日期都是未来日期
    const now = new Date();
    expect(date1 > now).toBe(true);
    expect(date2 > now).toBe(true);
    expect(date3 > now).toBe(true);
    expect(date4 > now).toBe(true);
  });
});
