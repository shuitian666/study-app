/**
 * ============================================================================
 * 学习工具函数 (Review Utils)
 * ============================================================================
 *
 * 【函数清单】
 * - generateTodayReviewPlan(kps, existingItems?) → 基于间隔重复算法生成今日复习/新学计划
 * - calculateNewProficiency(current, isCorrect) → 答题后计算新掌握度
 * - getNextReviewDate(proficiency) → 根据掌握度计算下次复习日期
 * - formatDate(dateStr) → ISO 日期转中文"月日"格式
 * - getGreeting() → 基于当前时段的问候语
 * - getEncouragement() → 随机静态鼓励语（AI 鼓励语的兜底方案）
 *
 * 【间隔重复参数】定义在 types/index.ts 的 PROFICIENCY_MAP：
 * none=1天, rusty=2.5天, normal=7天, master=22天
 *
 * 【重要】generateTodayReviewPlan 的 existingNewItems 参数：
 * 当用户完成新学后，知识点状态会变为 reviewCount > 0，不再被视为"新学"。
 * 为了保留已完成新学的状态（completed: true），需要传入 existingNewItems
 * 以确保首页显示的进度是正确的（如 3/15）。
 * ============================================================================
 */

import type { KnowledgePoint, ReviewItem, ProficiencyLevel } from '@/types';
import { PROFICIENCY_MAP } from '@/types';

/**
 * 生成今日复习/新学计划
 *
 * 【核心逻辑】
 * 1. 遍历所有知识点
 * 2. 如果 reviewCount === 0 且 proficiency === 'none' → 新学项目
 * 3. 如果 nextReviewAt <= 今天 → 待复习项目
 *
 * 【关于 existingNewItems 参数】
 * 作用：保留已完成新学项目的状态
 * 场景：用户学习了一个新知识点后，该点的 reviewCount 会变成 1，
 *       此时 generateTodayReviewPlan 不会再把它加入 newItems 列表。
 *       这会导致 completedNew 的计算出错（已完成的数量丢失）。
 * 解决：传入已存在的 newItems 列表，如果知识点仍然存在，保留其完成状态
 *
 * @param knowledgePoints - 所有知识点
 * @param existingNewItems - 已存在的新学项目（来自 state.todayNewItems）
 * @returns 今日复习列表和新学列表
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

  // 【关键】创建已存在新学项目的映射，用于快速查找
  // 这样即使知识点状态变化，也能保留完成状态
  const existingNewMap = new Map<string, ReviewItem>();
  if (existingNewItems) {
    existingNewItems.forEach(item => existingNewMap.set(item.knowledgePointId, item));
  }

  for (const kp of knowledgePoints) {
    // 【新学判断优先】先检查是否已存在于今日新学计划中（保留完成状态）
    // 这样做可以确保即使 proficiency 已改变（用户已学习过），仍然能追踪新学进度
    const existing = existingNewMap.get(kp.id);
    if (existing) {
      // 【关键】如果已存在于今日计划中，直接保留（无论 proficiency 是否改变）
      newItems.push(existing);
      continue;
    }

    // 【新学判断】从未学习过的知识点（reviewCount === 0 且 proficiency === 'none'）
    if (kp.reviewCount === 0 && kp.proficiency === 'none') {
      // 新的新学项目
      newItems.push({
        knowledgePointId: kp.id,
        type: 'new',
        scheduledAt: today,
        completed: false,
      });
      continue;
    }

    // 【复习判断】根据 nextReviewAt 判断是否需要复习
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

  // 复习列表按掌握度排序：掌握度低的优先复习
  const profOrder: Record<ProficiencyLevel, number> = { none: 0, rusty: 1, normal: 2, master: 3 };
  review.sort((a, b) => {
    const kpA = knowledgePoints.find(k => k.id === a.knowledgePointId);
    const kpB = knowledgePoints.find(k => k.id === b.knowledgePointId);
    return (profOrder[kpA?.proficiency ?? 'none']) - (profOrder[kpB?.proficiency ?? 'none']);
  });

  return { review, newItems };
}

/**
 * 根据答题正确性计算新的掌握度
 * 正确 → 提升一级（最高 master）
 * 错误 → 降低一级（最低 none）
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
 * 根据掌握度计算下次复习日期
 */
export function getNextReviewDate(proficiency: ProficiencyLevel): string {
  const days = PROFICIENCY_MAP[proficiency].reviewIntervalDays;
  const next = new Date(Date.now() + days * 86400000);
  return next.toISOString();
}

/**
 * 格式化日期为中文"月日"格式
 */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}月${day}日`;
}

/**
 * 根据时间段获取问候语
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
 * 获取随机鼓励语（AI 鼓励语的兜底方案）
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
