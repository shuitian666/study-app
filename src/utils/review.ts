/**
 * Learning helpers for daily review and new-learning planning.
 */

import type { KnowledgePoint, ReviewItem, ProficiencyLevel } from '@/types';
import { PROFICIENCY_MAP } from '@/types';

function getDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isDueTodayOrEarlier(nextReviewAt: string | null | undefined, today: string): boolean {
  if (!nextReviewAt) return false;

  const nextDate = new Date(nextReviewAt);
  if (Number.isNaN(nextDate.getTime())) return false;

  return getDateKey(nextDate) <= today;
}

/**
 * Generate today's review/new plan.
 *
 * Review: learned cards that are due today or overdue.
 * New: cards without a successful first learning pass.
 */
export function generateTodayReviewPlan(
  knowledgePoints: KnowledgePoint[],
  existingNewItems?: ReviewItem[]
): {
  review: ReviewItem[];
  newItems: ReviewItem[];
} {
  const today = getDateKey(new Date());
  const review: ReviewItem[] = [];
  const newItems: ReviewItem[] = [];

  const existingNewMap = new Map<string, ReviewItem>();
  existingNewItems
    ?.filter(item => item.scheduledAt === today)
    .forEach(item => existingNewMap.set(item.knowledgePointId, item));

  for (const kp of knowledgePoints) {
    const existingNewItem = existingNewMap.get(kp.id);
    if (existingNewItem) {
      newItems.push(existingNewItem);
      continue;
    }

    const reviewCount = kp.reviewCount ?? 0;
    const isNewKnowledge = reviewCount === 0 || kp.lastReviewedAt === null;

    if (isNewKnowledge) {
      newItems.push({
        knowledgePointId: kp.id,
        type: 'new',
        scheduledAt: today,
        completed: false,
      });
      continue;
    }

    if (reviewCount > 0 && isDueTodayOrEarlier(kp.nextReviewAt, today)) {
      review.push({
        knowledgePointId: kp.id,
        type: 'review',
        scheduledAt: today,
        completed: false,
      });
    }
  }

  const profOrder: Record<ProficiencyLevel, number> = { none: 0, rusty: 1, normal: 2, master: 3 };
  review.sort((a, b) => {
    const kpA = knowledgePoints.find(k => k.id === a.knowledgePointId);
    const kpB = knowledgePoints.find(k => k.id === b.knowledgePointId);
    return (profOrder[kpA?.proficiency ?? 'none']) - (profOrder[kpB?.proficiency ?? 'none']);
  });

  return { review, newItems };
}

export function calculateNewProficiency(
  current: ProficiencyLevel,
  isCorrect: boolean
): ProficiencyLevel {
  const levels: ProficiencyLevel[] = ['none', 'rusty', 'normal', 'master'];
  const idx = levels.indexOf(current);

  if (isCorrect) {
    return levels[Math.min(idx + 1, levels.length - 1)];
  }
  return levels[Math.max(idx - 1, 0)];
}

export function getNextReviewDate(proficiency: ProficiencyLevel): string {
  const days = PROFICIENCY_MAP[proficiency].reviewIntervalDays;
  const next = new Date(Date.now() + days * 86400000);
  return next.toISOString();
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}\u6708${day}\u65e5`;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '\u591c\u6df1\u4e86\uff0c\u6ce8\u610f\u4f11\u606f';
  if (hour < 9) return '\u65e9\u4e0a\u597d\uff0c\u65b0\u7684\u4e00\u5929\u5f00\u59cb\u4e86';
  if (hour < 12) return '\u4e0a\u5348\u597d\uff0c\u5b66\u4e60\u6b63\u5f53\u65f6';
  if (hour < 14) return '\u4e2d\u5348\u597d\uff0c\u9002\u5f53\u4f11\u606f';
  if (hour < 18) return '\u4e0b\u5348\u597d\uff0c\u7ee7\u7eed\u52a0\u6cb9';
  if (hour < 22) return '\u665a\u4e0a\u597d\uff0c\u4eca\u5929\u6536\u83b7\u6ee1\u6ee1';
  return '\u591c\u6df1\u4e86\uff0c\u65e9\u70b9\u4f11\u606f\u5427';
}

export function getEncouragement(): string {
  const messages = [
    '\u575a\u6301\u5c31\u662f\u80dc\u5229\uff0c\u4f60\u5df2\u7ecf\u5f88\u68d2\u4e86\uff01',
    '\u5b66\u4e60\u7684\u8def\u4e0a\uff0c\u6bcf\u4e00\u6b65\u90fd\u7b97\u6570\u3002',
    '\u77e5\u8bc6\u6539\u53d8\u547d\u8fd0\uff0c\u52a0\u6cb9\uff01',
    '\u4eca\u5929\u7684\u52aa\u529b\uff0c\u662f\u660e\u5929\u7684\u8d44\u672c\u3002',
    '\u6bcf\u5929\u8fdb\u6b65\u4e00\u70b9\u70b9\uff0c\u7ec8\u5c06\u6210\u5c31\u5927\u4e0d\u540c\u3002',
    '\u6e29\u6545\u800c\u77e5\u65b0\uff0c\u4f60\u505a\u5f97\u5f88\u597d\uff01',
    '\u5b66\u800c\u4e0d\u601d\u5219\u7f54\uff0c\u601d\u800c\u4e0d\u5b66\u5219\u6b86\u3002',
    '\u5343\u91cc\u4e4b\u884c\uff0c\u59cb\u4e8e\u8db3\u4e0b\u3002',
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}
