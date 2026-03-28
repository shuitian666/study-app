/**
 * ============================================================================
 * 学习工具函数 (Review Utils)
 * ============================================================================
 *
 * 【函数清单】
 * - generateTodayReviewPlan(kps) → 基于间隔重复算法生成今日复习/新学计划
 * - calculateNewProficiency(current, isCorrect) → 答题后计算新掌握度
 * - getNextReviewDate(proficiency) → 根据掌握度计算下次复习日期
 * - formatDate(dateStr) → ISO 日期转中文"月日"格式
 * - getGreeting() → 基于当前时段的问候语
 * - getEncouragement() → 随机静态鼓励语（AI 鼓励语的兜底方案）
 *
 * 【间隔重复参数】定义在 types/index.ts 的 PROFICIENCY_MAP：
 * none=1天, rusty=2.5天, normal=7天, master=22天
 * ============================================================================
 */

import type { KnowledgePoint, ReviewItem, ProficiencyLevel } from '@/types';
import { PROFICIENCY_MAP } from '@/types';

/**
 * Generate today's review items based on spaced repetition algorithm.
 * - none: review every day
 * - rusty: review every 2-3 days
 * - normal: review every ~7 days
 * - master: review every 15-30 days
 * 
 * @param knowledgePoints - all knowledge points
 * @param existingNewItems - existing new items to preserve (from today), so completed items stay in list
 */
export function generateTodayReviewPlan(
  knowledgePoints: KnowledgePoint[],
  existingNewItems?: ReviewItem[]
): {
  review: ReviewItem[];
  newItems: ReviewItem[];
} {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const review: ReviewItem[] = [];
  const newItems: ReviewItem[] = [];

  // Create a map of existing new items for quick lookup (preserve completed state)
  const existingNewMap = new Map<string, ReviewItem>();
  if (existingNewItems) {
    existingNewItems.forEach(item => existingNewMap.set(item.knowledgePointId, item));
  }

  for (const kp of knowledgePoints) {
    if (kp.reviewCount === 0 && kp.proficiency === 'none') {
      // Check if this item already exists in the existing list (preserve completed state)
      const existing = existingNewMap.get(kp.id);
      if (existing) {
        // Keep existing item with its completed state
        newItems.push(existing);
      } else {
        // New item never reviewed
        newItems.push({
          knowledgePointId: kp.id,
          type: 'new',
          scheduledAt: today,
          completed: false,
        });
      }
      continue;
    }

    if (kp.nextReviewAt) {
      const nextDate = new Date(kp.nextReviewAt).toISOString().slice(0, 10);
      if (nextDate <= today) {
        review.push({
          knowledgePointId: kp.id,
          type: 'review',
          scheduledAt: today,
          completed: false,
        });
      }
    }
  }

  // Sort: lower proficiency first
  const profOrder: Record<ProficiencyLevel, number> = { none: 0, rusty: 1, normal: 2, master: 3 };
  review.sort((a, b) => {
    const kpA = knowledgePoints.find(k => k.id === a.knowledgePointId);
    const kpB = knowledgePoints.find(k => k.id === b.knowledgePointId);
    return (profOrder[kpA?.proficiency ?? 'none']) - (profOrder[kpB?.proficiency ?? 'none']);
  });

  return { review, newItems };
}

/**
 * Calculate next proficiency based on quiz correctness.
 */
export function calculateNewProficiency(
  current: ProficiencyLevel,
  isCorrect: boolean
): ProficiencyLevel {
  const levels: ProficiencyLevel[] = ['none', 'rusty', 'normal', 'master'];
  const idx = levels.indexOf(current);

  if (isCorrect) {
    return levels[Math.min(idx + 1, 3)];
  } else {
    return levels[Math.max(idx - 1, 0)];
  }
}

/**
 * Calculate next review date based on proficiency.
 */
export function getNextReviewDate(proficiency: ProficiencyLevel): string {
  const days = PROFICIENCY_MAP[proficiency].reviewIntervalDays;
  const next = new Date(Date.now() + days * 86400000);
  return next.toISOString();
}

/**
 * Format date to readable Chinese string.
 */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}月${day}日`;
}

/**
 * Get greeting based on time of day.
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了，注意休息';
  if (hour < 9) return '早上好，新的一天开始了';
  if (hour < 12) return '上午好，学习正当时';
  if (hour < 14) return '中午好，适当休息';
  if (hour < 18) return '下午好，继续加油';
  if (hour < 22) return '晚上好，今天收获满满';
  return '夜深了，早点休息吧';
}

/**
 * Generate a random encouragement message.
 */
export function getEncouragement(): string {
  const messages = [
    '坚持就是胜利，你已经很棒了！',
    '学习的路上，每一步都算数。',
    '知识改变命运，加油！',
    '今天的努力，是明天的资本。',
    '每天进步一点点，终将成就大不同。',
    '温故而知新，你做得很好！',
    '学而不思则罔，思而不学则殆。',
    '千里之行，始于足下。',
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}
