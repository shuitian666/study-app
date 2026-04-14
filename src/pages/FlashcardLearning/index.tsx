/**
 * 闪记卡学习页面
 * 基于墨墨背单词的简单学习逻辑 + FSRS 评分系统
 *
 * 核心逻辑：
 * - 不会的卡进入"待复习"列表，本次末尾重现
 * - 同一张卡反复点不会，反复重现（直到认识为止）
 * - Good 及以上才算掌握，进入下一张
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useUser } from '@/store/UserContext';
import { useTheme } from '@/store/ThemeContext';
import { useLearning } from '@/store/LearningContext';
import { useGame } from '@/store/GameContext';
import { ArrowLeft, Home, BookOpen, ChevronRight } from 'lucide-react';
import FlashcardCard from '@/components/ui/FlashcardCard';
import {
  knowledgePointToCardInput,
  cardToFsrsFields,
  reviewCard,
  previewCard,
  shouldShowEasy,
  isAgain,
  type RatingOption,
} from '@/utils/fsrsScheduler';
import { Rating } from 'ts-fsrs';
import type { KnowledgePointExtended } from '@/types';

// 按钮配置
const RATING_CONFIG = {
  again: {
    label: '不会',
    emoji: '😰',
    bgColor: '#fef2f2',
    textColor: '#ef4444',
    borderColor: '#fecaca',
  },
  hard: {
    label: '困难',
    emoji: '🤔',
    bgColor: '#fffbeb',
    textColor: '#f59e0b',
    borderColor: '#fde68a',
  },
  good: {
    label: '一般',
    emoji: '🙂',
    bgColor: '#ecfdf5',
    textColor: '#10b981',
    borderColor: '#a7f3d0',
  },
  easy: {
    label: '简单',
    emoji: '😎',
    bgColor: '#eff6ff',
    textColor: '#3b82f6',
    borderColor: '#bfdbfe',
  },
};

function buildSessionQueue(knowledgePoints: KnowledgePointExtended[]): KnowledgePointExtended[] {
  const now = new Date();
  return knowledgePoints
    .filter(kp => kp.proficiency !== 'master')
    .map(kp => {
      const isOverdue = !!(kp.nextReviewAt && kp.nextReviewAt < now.toISOString());
      const isDueToday = !!(
        kp.nextReviewAt &&
        kp.nextReviewAt.slice(0, 10) === now.toISOString().slice(0, 10)
      );

      let priority: number;
      if (kp.fsrsState === 'New' || !kp.fsrsReps) {
        priority = 3;
      } else if (isOverdue) {
        priority = 0;
      } else if (isDueToday) {
        priority = 1;
      } else {
        priority = 2;
      }

      return { ...kp, _priority: priority };
    })
    .sort((a, b) => {
      if (a._priority !== b._priority) {
        return a._priority - b._priority;
      }
      const profOrder: Record<string, number> = { none: 0, rusty: 1, normal: 2, master: 3 };
      return (profOrder[a.proficiency] ?? 0) - (profOrder[b.proficiency] ?? 0);
    });
}

export default function FlashcardLearningPage() {
  const { navigate } = useUser();
  const { theme } = useTheme();
  const { learningState, learningDispatch } = useLearning();
  const { checkAchievements } = useGame();

  // 卡片翻转状态
  const [isFlipped, setIsFlipped] = useState(false);
  // 滑动方向
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);

  // 学习队列（包含所有待学习的卡片，按优先级排序）
  const [queue, setQueue] = useState<KnowledgePointExtended[]>(() => buildSessionQueue(learningState.knowledgePoints));
  // 当前显示的卡片在队列中的索引
  const [currentIdx, setCurrentIdx] = useState(0);
  // 不会的卡片的 ID 集合（用于检测重复）
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  // 是否显示知识点预览
  const [showKnowledge, setShowKnowledge] = useState(false);
  // 是否正在重现失败卡（用于显示提示）
  const [isRevealingFailed, setIsRevealingFailed] = useState(false);
  // 是否正在处理评分（用于防抖）
  const [isSelecting, setIsSelecting] = useState(false);

  // 使用 ref 存储最新状态，避免闭包陷阱
  const queueRef = useRef(queue);
  const failedIdsRef = useRef(failedIds);
  const currentIdxRef = useRef(currentIdx);

  // 同步 ref
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { failedIdsRef.current = failedIds; }, [failedIds]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  // 当前卡片
  const currentKp = queue[currentIdx];
  const totalCards = queue.length;
  // 有多少张"不会"的卡还没重现
  const failedCount = failedIds.size;

  // 预览当前卡片在不同评分下的结果
  const currentPreview = useMemo(() => {
    if (!currentKp) return null;
    const cardInput = knowledgePointToCardInput(currentKp);
    return previewCard(cardInput);
  }, [currentKp]);

  // 翻转卡片
  const handleFlip = useCallback(() => {
    setIsFlipped(prev => !prev);
    // 翻转时关闭知识点预览和重现提示
    setShowKnowledge(false);
    setIsRevealingFailed(false);
  }, []);

  // 移动到下一张卡片（使用 ref 避免闭包陷阱）
  const moveToNext = useCallback(() => {
    const currentIndex = currentIdxRef.current;
    const currentQueue = queueRef.current;
    const currentFailedIds = failedIdsRef.current;

    if (currentIndex < currentQueue.length - 1) {
      // 还有卡片，检查下一张是否是失败卡
      const nextCard = currentQueue[currentIndex + 1];
      if (nextCard && currentFailedIds.has(nextCard.id)) {
        // 下一张是失败卡，设置重现状态并直接跳转
        setIsRevealingFailed(true);
        setCurrentIdx(prev => prev + 1);
      } else {
        // 下一张是普通卡，直接前进
        setCurrentIdx(prev => prev + 1);
      }
    } else if (currentFailedIds.size > 0) {
      // 主队列空了，但有待重现的卡
      // 从队列中移除失败卡，重置索引从头开始重现
      const failedCards = currentQueue.filter(kp => currentFailedIds.has(kp.id));
      setQueue(failedCards);
      setFailedIds(new Set());
      setCurrentIdx(0);
      setIsRevealingFailed(true);
    } else {
      // 全部完成
      setIsRevealingFailed(false);
      setCurrentIdx(currentQueue.length);
    }
  }, []);

  // 处理评分选择
  const handleSelect = useCallback((rating: RatingOption) => {
    // 防抖：如果正在处理中，直接返回
    if (isSelecting || !currentKp) return;
    setIsSelecting(true);

    const cardInput = knowledgePointToCardInput(currentKp);
    const result = reviewCard(cardInput, rating);

    // 更新 FSRS 字段
    const fsrsUpdates = cardToFsrsFields(result.card);
    learningDispatch({
      type: 'UPDATE_FSRS_CARD',
      payload: {
        knowledgePointId: currentKp.id,
        updates: {
          ...fsrsUpdates,
          proficiency: result.card.state === 2 ? 'normal' : currentKp.proficiency,
        },
      },
    });

    // 完成复习项
    const reviewItem = learningState.todayReviewItems.find(
      r => r.knowledgePointId === currentKp.id
    );
    if (reviewItem) {
      learningDispatch({ type: 'COMPLETE_REVIEW_ITEM', payload: currentKp.id });
    }

    // 设置滑动方向
    if (isAgain(rating)) {
      setSwipeDirection('left');
      // 不会：把卡片 ID 加入失败列表，稍后重现
      setFailedIds(prev => new Set(prev).add(currentKp.id));
    } else if (rating === 'hard') {
      setSwipeDirection('up');
      // 困难：加入失败列表，需要加强记忆
      setFailedIds(prev => new Set(prev).add(currentKp.id));
    } else {
      setSwipeDirection('down');
    }

    // Check achievements
    const kps = learningState.knowledgePoints;
    const masteredCount = kps.filter(kp => kp.proficiency === 'master').length;
    checkAchievements({
      knowledgePointCount: kps.length,
      masteredCount,
    });

    // 延迟后跳转到下一张
    setTimeout(() => {
      setIsFlipped(false);
      setSwipeDirection(null);
      moveToNext();
      setIsSelecting(false);  // 解锁
    }, 200);
  }, [currentKp, learningDispatch, learningState.todayReviewItems, moveToNext, isSelecting]);

  // 上一张卡片
  const goToPrev = useCallback(() => {
    if (currentIdx > 0) {
      setCurrentIdx(prev => prev - 1);
      setIsFlipped(false);
      setSwipeDirection('up');
      setTimeout(() => setSwipeDirection(null), 200);
    }
  }, [currentIdx]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault();
          setIsFlipped(prev => !prev);
          break;
        case '1':
        case 'a':
        case 'A':
          handleSelect('again');
          break;
        case '2':
        case 'h':
        case 'H':
          handleSelect('hard');
          break;
        case '3':
        case 'g':
        case 'G':
          handleSelect('good');
          break;
        case '4':
        case 'e':
        case 'E':
          if (currentKp && shouldShowEasy(knowledgePointToCardInput(currentKp))) {
            handleSelect('easy');
          }
          break;
        case 'ArrowLeft':
          goToPrev();
          break;
        case 'Escape':
          navigate('home');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSelect, goToPrev, navigate, currentKp]);

  // 无卡片时
  if (!currentKp || queue.length === 0) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ backgroundColor: theme.bg }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-center px-6">
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="text-2xl font-bold mb-3" style={{ color: theme.textPrimary }}>
              太棒了！
            </h2>
            <p className="text-base mb-8" style={{ color: theme.textSecondary }}>
              所有知识点都已复习，继续保持！
            </p>
            <button
              onClick={() => navigate('home')}
              className="px-8 py-3 rounded-xl font-medium text-white"
              style={{ backgroundColor: theme.primary }}
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showEasy = currentKp && shouldShowEasy(knowledgePointToCardInput(currentKp));
  const againPreview = currentPreview?.[Rating.Again];
  const hardPreview = currentPreview?.[Rating.Hard];
  const goodPreview = currentPreview?.[Rating.Good];
  const easyPreview = currentPreview?.[Rating.Easy];

  // 显示进度信息
  const progressText = failedCount > 0
    ? `${currentIdx + 1} / ${totalCards} (+${failedCount}待复习)`
    : `${currentIdx + 1} / ${totalCards}`;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: theme.bg }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: theme.bgCard }}>
        <button
          onClick={() => navigate('home')}
          className="p-2 rounded-full active:opacity-70 transition-opacity"
          style={{ backgroundColor: `${theme.primary}15` }}
        >
          <ArrowLeft size={20} style={{ color: theme.primary }} />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: theme.textSecondary }}>
            {progressText}
          </span>
        </div>
        <div className="w-10" />
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2" style={{ backgroundColor: theme.bgCard }}>
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: theme.border }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${((currentIdx + 1) / totalCards) * 100}%`,
              backgroundColor: theme.primary
            }}
          />
        </div>
      </div>

      {/* 失败卡重现提示 */}
      {isRevealingFailed && (
        <div className="px-4 py-2" style={{ backgroundColor: theme.bgCard }}>
          <div className="text-center text-xs py-1 rounded-lg" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
            📚 正在重现之前不会的卡片
          </div>
        </div>
      )}

      {/* 知识点预览按钮 - 仅在未翻转时显示 */}
      {!isFlipped && (
        <div className="px-4 pt-2">
          <button
            onClick={() => setShowKnowledge(!showKnowledge)}
            className="w-full rounded-xl p-3 border flex items-center justify-between transition-all"
            style={{
              backgroundColor: showKnowledge ? '#eff6ff' : 'transparent',
              borderColor: '#dbeafe'
            }}
          >
            <div className="flex items-center gap-2 text-sm" style={{ color: '#1e40af' }}>
              <BookOpen size={14} />
              <span>先回顾知识点：{currentKp.name}</span>
            </div>
            <ChevronRight
              size={14}
              style={{
                color: '#60a5fa',
                transform: showKnowledge ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}
            />
          </button>

          {showKnowledge && (
            <div
              className="mt-2 rounded-xl p-4 border text-sm"
              style={{
                backgroundColor: '#eff6ff',
                borderColor: '#dbeafe',
                color: '#1e40af'
              }}
            >
              <p className="leading-relaxed">{currentKp.explanation || '暂无解析'}</p>
              {currentKp.memoryTip && (
                <p className="mt-2 text-xs" style={{ color: theme.textMuted }}>
                  💡 记忆提示：{currentKp.memoryTip}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Card area with side navigation */}
      <div className="flex-1 flex items-center relative">
        {/* Left button - previous */}
        <button
          onClick={goToPrev}
          disabled={currentIdx === 0}
          className="absolute left-2 w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed z-10"
          style={{ backgroundColor: `${theme.primary}20`, color: theme.primary }}
        >
          ‹
        </button>

        {/* Card */}
        <div className="flex-1 flex items-center justify-center p-4">
          <FlashcardCard
            name={currentKp.name}
            explanation={currentKp.explanation || '暂无解析'}
            memoryTip={currentKp.memoryTip}
            isFlipped={isFlipped}
            onFlip={handleFlip}
            swipeDirection={swipeDirection}
          />
        </div>

        {/* Right button - home */}
        <button
          onClick={() => navigate('home')}
          className="absolute right-2 w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 z-10"
          style={{ backgroundColor: `${theme.primary}20`, color: theme.primary }}
        >
          <Home size={22} />
        </button>
      </div>

      {/* Rating buttons - 4 buttons horizontal layout */}
      <div className="px-4 pb-6">
        <div className="grid grid-cols-4 gap-2">
          {/* Again - 不会 */}
          <button
            onClick={() => handleSelect('again')}
            className="py-3 px-1 rounded-xl font-medium text-center transition-transform active:scale-95 flex flex-col items-center border-2"
            style={{
              backgroundColor: RATING_CONFIG.again.bgColor,
              color: RATING_CONFIG.again.textColor,
              borderColor: RATING_CONFIG.again.borderColor,
            }}
          >
            <div className="text-lg mb-0.5">{RATING_CONFIG.again.emoji}</div>
            <div className="text-xs font-medium">{RATING_CONFIG.again.label}</div>
            {againPreview && (
              <div className="text-[10px] mt-0.5 opacity-70">{againPreview.nextReviewText}</div>
            )}
          </button>

          {/* Hard - 困难 */}
          <button
            onClick={() => handleSelect('hard')}
            className="py-3 px-1 rounded-xl font-medium text-center transition-transform active:scale-95 flex flex-col items-center border-2"
            style={{
              backgroundColor: RATING_CONFIG.hard.bgColor,
              color: RATING_CONFIG.hard.textColor,
              borderColor: RATING_CONFIG.hard.borderColor,
            }}
          >
            <div className="text-lg mb-0.5">{RATING_CONFIG.hard.emoji}</div>
            <div className="text-xs font-medium">{RATING_CONFIG.hard.label}</div>
            {hardPreview && (
              <div className="text-[10px] mt-0.5 opacity-70">{hardPreview.nextReviewText}</div>
            )}
          </button>

          {/* Good - 一般 */}
          <button
            onClick={() => handleSelect('good')}
            className="py-3 px-1 rounded-xl font-medium text-center transition-transform active:scale-95 flex flex-col items-center border-2"
            style={{
              backgroundColor: RATING_CONFIG.good.bgColor,
              color: RATING_CONFIG.good.textColor,
              borderColor: RATING_CONFIG.good.borderColor,
            }}
          >
            <div className="text-lg mb-0.5">{RATING_CONFIG.good.emoji}</div>
            <div className="text-xs font-medium">{RATING_CONFIG.good.label}</div>
            {goodPreview && (
              <div className="text-[10px] mt-0.5 opacity-70">{goodPreview.nextReviewText}</div>
            )}
          </button>

          {/* Easy - 简单 */}
          <button
            onClick={() => showEasy && handleSelect('easy')}
            className={`py-3 px-1 rounded-xl font-medium text-center transition-transform active:scale-95 flex flex-col items-center border-2 ${
              showEasy ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
            }`}
            style={{
              backgroundColor: RATING_CONFIG.easy.bgColor,
              color: RATING_CONFIG.easy.textColor,
              borderColor: RATING_CONFIG.easy.borderColor,
            }}
          >
            <div className="text-lg mb-0.5">{RATING_CONFIG.easy.emoji}</div>
            <div className="text-xs font-medium">{RATING_CONFIG.easy.label}</div>
            {showEasy && easyPreview && (
              <div className="text-[10px] mt-0.5 opacity-70">{easyPreview.nextReviewText}</div>
            )}
            {!showEasy && (
              <div className="text-[10px] mt-0.5 opacity-70">-</div>
            )}
          </button>
        </div>

        {/* Relearning 状态提示 */}
        {currentPreview && (currentPreview[Rating.Again]?.isRelearning || currentPreview[Rating.Hard]?.isRelearning) && (
          <div className="mt-2 text-xs text-center py-1 rounded-lg" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
            🔄 进入重新学习模式
          </div>
        )}

        {/* Keyboard hints */}
        <div className="flex justify-center gap-4 mt-3 text-xs" style={{ color: theme.textMuted }}>
          <span>1/2/3/4</span>
          <span>空格翻转</span>
        </div>
      </div>
    </div>
  );
}
