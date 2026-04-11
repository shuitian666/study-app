/**
 * FSRS 调度器封装
 * 将 ts-fsrs 算法适配到 KnowledgePoint 数据结构
 */

import { fsrs, Rating, State, type Card, type CardInput, type Grade } from 'ts-fsrs';
import type { KnowledgePointExtended } from '@/types';

// FSRS 默认参数
const FSRS_CONFIG = {
  request_retention: 0.9,      // 目标记忆保留率 90%
  maximum_interval: 36500,      // 最大间隔 100 年
  enable_fuzz: true,           // 启用模糊（防止卡片堆叠）
  enable_short_term: true,     // 启用短时学习步骤
  learning_steps: ['1m', '10m'] as const,  // 学习步骤：1分钟 → 10分钟
  relearning_steps: ['10m'] as const,       // 重学步骤：10分钟
};

// 创建 FSRS 实例
const fsrsInstance = fsrs(FSRS_CONFIG);

/**
 * 将 KnowledgePoint 转换为 FSRS CardInput
 */
export function knowledgePointToCardInput(kp: KnowledgePointExtended): CardInput {
  const stateMap: Record<string, State> = {
    'New': State.New,
    'Learning': State.Learning,
    'Review': State.Review,
    'Relearning': State.Relearning,
  };

  // 新卡片（从未学习）的 stability 为 0
  // FSRS 要求新卡片的 difficulty 也必须为 0，才能正确初始化
  const isNewCard = !kp.fsrsStability || kp.fsrsStability === 0;

  return {
    stability: kp.fsrsStability ?? 0,
    difficulty: isNewCard ? 0 : (kp.fsrsDifficulty ?? 5),
    elapsed_days: 0,
    scheduled_days: 0,
    reps: kp.fsrsReps ?? 0,
    lapses: kp.fsrsLapses ?? 0,
    learning_steps: kp.fsrsLearningSteps ?? 0,
    state: kp.fsrsState
      ? (stateMap[kp.fsrsState] ?? State.New)
      : State.New,
    due: kp.nextReviewAt ? new Date(kp.nextReviewAt) : new Date(),
    last_review: kp.lastReviewedAt ? new Date(kp.lastReviewedAt) : null,
  };
}

/**
 * 将 FSRS Card 转换回 KnowledgePoint 的 FSRS 字段
 */
export function cardToFsrsFields(card: Card): Partial<KnowledgePointExtended> {
  const stateMap: Record<State, string> = {
    [State.New]: 'New',
    [State.Learning]: 'Learning',
    [State.Review]: 'Review',
    [State.Relearning]: 'Relearning',
  };

  return {
    fsrsStability: card.stability,
    fsrsDifficulty: card.difficulty,
    fsrsState: stateMap[card.state] as KnowledgePointExtended['fsrsState'],
    fsrsLearningSteps: card.learning_steps,
    fsrsLapses: card.lapses,
    fsrsReps: card.reps,
    nextReviewAt: card.due.toISOString(),
    lastReviewedAt: card.last_review?.toISOString() ?? null,
  };
}

/**
 * 评分选项
 */
export type RatingOption = 'again' | 'hard' | 'good' | 'easy';

/**
 * 将我们的评分选项转换为 FSRS Grade
 * Grade = Exclude<Rating, Rating.Manual> = 1 | 2 | 3 | 4
 */
export function toFsrsRating(option: RatingOption): Grade {
  switch (option) {
    case 'again': return Rating.Again;
    case 'hard': return Rating.Hard;
    case 'good': return Rating.Good;
    case 'easy': return Rating.Easy;
  }
}

/**
 * 复习结果
 */
export interface ReviewResult {
  card: Card;
  // 下次复习的描述（用于 UI 显示）
  nextReviewText: string;
  // 是否进入重学状态
  isRelearning: boolean;
  // 是否从学习阶段毕业到复习
  graduatedToReview: boolean;
}

/**
 * 预览某张卡在当前状态下，所有评分的结果
 */
export function previewCard(cardInput: CardInput): Record<Rating, ReviewResult> {
  const now = new Date();
  const preview = fsrsInstance.repeat(cardInput, now);

  const result: Partial<Record<Rating, ReviewResult>> = {};

  // IPreview 只包含 Again, Hard, Good, Easy (不含 Manual)
  // 所以我们需要用类型断言或者枚举来访问
  const ratings: Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];
  for (const rating of ratings) {
    // IPreview 可以通过数字索引访问
    const item = (preview as unknown as Record<number, { card: Card; log: unknown }>)[rating];
    if (item) {
      result[rating as Rating] = {
        card: item.card,
        nextReviewText: getNextReviewText(item.card, rating),
        isRelearning: item.card.state === State.Relearning,
        graduatedToReview: item.card.state === State.Review &&
          cardInput.state !== State.Review &&
          cardInput.state !== State.Relearning,
      };
    }
  }

  return result as Record<Rating, ReviewResult>;
}

/**
 * 对一张卡进行评分
 */
export function reviewCard(
  cardInput: CardInput,
  ratingOption: RatingOption
): ReviewResult {
  const now = new Date();
  const grade = toFsrsRating(ratingOption);
  const item = fsrsInstance.next(cardInput, now, grade);

  return {
    card: item.card,
    nextReviewText: getNextReviewText(item.card, grade),
    isRelearning: item.card.state === State.Relearning,
    graduatedToReview: item.card.state === State.Review &&
      cardInput.state !== State.Review &&
      cardInput.state !== State.Relearning,
  };
}

/**
 * 生成下次复习时间的描述文本
 */
function getNextReviewText(card: Card, _rating: Grade): string {
  // 计算从现在到到期日的时间差
  const now = Date.now();
  const dueTime = card.due.getTime();
  const diffMs = dueTime - now;

  if (card.state === State.New || card.state === State.Learning) {
    // 学习阶段显示分钟
    const minutes = Math.max(0, Math.round(diffMs / 60000));
    if (minutes < 1) {
      return '<1分钟';
    } else if (minutes < 60) {
      return `${minutes}分钟`;
    } else {
      const hours = Math.round(minutes / 60);
      return `${hours}小时`;
    }
  } else if (card.state === State.Relearning) {
    // 重学阶段
    const minutes = Math.max(0, Math.round(diffMs / 60000));
    if (minutes < 1) {
      return '<1分钟';
    } else if (minutes < 60) {
      return `${minutes}分钟`;
    } else {
      const hours = Math.round(minutes / 60);
      return `${hours}小时`;
    }
  } else {
    // 复习阶段显示天数
    const days = card.scheduled_days;
    if (days === 0) {
      return '今天';
    } else if (days === 1) {
      return '明天';
    } else if (days < 30) {
      return `${days}天`;
    } else if (days < 365) {
      const months = Math.round(days / 30);
      return `${months}月`;
    } else {
      const years = Math.round(days / 365 * 10) / 10;
      return `${years}年`;
    }
  }
}

/**
 * 获取卡片的当前可回忆率（Retrievability）
 */
export function getRetrievability(cardInput: CardInput): string {
  return fsrsInstance.get_retrievability(cardInput);
}

/**
 * 判断是否是"不会"（需要进入重学队列）
 */
export function isAgain(rating: RatingOption): boolean {
  return rating === 'again';
}

/**
 * 判断是否应该显示"Easy"按钮
 * 新卡片首次学习时不显示Easy（reps=0），因为还没有建立稳定记忆
 * 但已经从 Learning 阶段毕业的卡片可以显示
 */
export function shouldShowEasy(cardInput: CardInput): boolean {
  // 有过复习记录，或已经从 Learning 阶段毕业到 Review 状态
  return cardInput.reps > 0 || cardInput.state === State.Review;
}

/**
 * 判断卡片是否完成学习（可以进入复习队列）
 */
export function isLearned(cardInput: CardInput): boolean {
  return cardInput.state === State.Review || cardInput.state === State.Relearning;
}
