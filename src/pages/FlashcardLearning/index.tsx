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
import { ArrowLeft, Home, BookOpen, ChevronRight, X, MessageSquare, Loader2, Sparkles } from 'lucide-react';
import FlashcardCard from '@/components/ui/FlashcardCard';
import { usePreGenerate } from '@/hooks/usePreGenerate';
import { checkBackendAvailable, getAIConfig } from '@/services/aiClient';
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
import type { KnowledgePointExtended, Question } from '@/types';
import { getTodayLearningProgress } from '@/utils/dailyLearningProgress';

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

const FLASHCARD_SCORE_MAP: Record<RatingOption, number> = {
  again: 40,
  hard: 60,
  good: 80,
  easy: 100,
};

function buildSessionQueue(
  knowledgePoints: KnowledgePointExtended[],
  targetIds?: Set<string>,
): KnowledgePointExtended[] {
  const now = new Date();
  return knowledgePoints
    .filter(kp => !targetIds || targetIds.has(kp.id))
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
  const { navigate, userState } = useUser();
  const { theme } = useTheme();
  const { learningState, learningDispatch } = useLearning();
  const { checkAchievements } = useGame();
  const { getSavedExplanation, generateExplanationOnDemand } = usePreGenerate();

  const importedIdSet = useMemo(() => {
    if (userState.currentPage !== 'flashcard-learning') {
      return undefined;
    }

    const importedIds = userState.pageParams.importedIds
      ?.split(',')
      .map(id => id.trim())
      .filter(Boolean);

    return importedIds && importedIds.length > 0 ? new Set(importedIds) : undefined;
  }, [userState.currentPage, userState.pageParams.importedIds]);

  const importResultSummary = useMemo(() => {
    if (userState.currentPage !== 'flashcard-learning' || userState.pageParams.source !== 'import') {
      return null;
    }

    const importedKnowledgeCount = Number.parseInt(userState.pageParams.importedKnowledgeCount ?? '0', 10) || 0;
    const importedQuestionCount = Number.parseInt(userState.pageParams.importedQuestionCount ?? '0', 10) || 0;
    const skippedQuestionCount = Number.parseInt(userState.pageParams.skippedQuestionCount ?? '0', 10) || 0;

    return {
      importedKnowledgeCount,
      importedQuestionCount,
      skippedQuestionCount,
    };
  }, [
    userState.currentPage,
    userState.pageParams.importedKnowledgeCount,
    userState.pageParams.importedQuestionCount,
    userState.pageParams.skippedQuestionCount,
    userState.pageParams.source,
  ]);

  // 卡片翻转状态
  const [isFlipped, setIsFlipped] = useState(false);
  // 滑动方向
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);

  // 学习队列（包含所有待学习的卡片，按优先级排序）
  const [queue, setQueue] = useState<KnowledgePointExtended[]>(() => buildSessionQueue(learningState.knowledgePoints, importedIdSet));
  // 当前显示的卡片在队列中的索引
  const [currentIdx, setCurrentIdx] = useState(0);
  // 不会的卡片的 ID 集合（用于检测重复）
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  // 是否显示知识点预览
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [sessionMode, setSessionMode] = useState<'flashcard' | 'quiz'>('flashcard');
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [showQuizResult, setShowQuizResult] = useState(false);
  const [generatingExplanation, setGeneratingExplanation] = useState(false);
  const [aiAssistAvailable, setAiAssistAvailable] = useState(false);
  const [aiAssistHint, setAiAssistHint] = useState('请先在设置里配置 AI');
  // 是否正在重现失败卡（用于显示提示）
  const [isRevealingFailed, setIsRevealingFailed] = useState(false);
  // 是否正在处理评分（用于防抖）
  const [isSelecting, setIsSelecting] = useState(false);
  const [showImportResult, setShowImportResult] = useState(true);

  // 使用 ref 存储最新状态，避免闭包陷阱
  const queueRef = useRef(queue);
  const failedIdsRef = useRef(failedIds);
  const currentIdxRef = useRef(currentIdx);

  // 同步 ref
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { failedIdsRef.current = failedIds; }, [failedIds]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  useEffect(() => {
    setQueue(buildSessionQueue(learningState.knowledgePoints, importedIdSet));
    setCurrentIdx(0);
    setFailedIds(new Set());
    setIsFlipped(false);
    setShowKnowledge(false);
    setSessionMode('flashcard');
    setCurrentQuizIndex(0);
    setSelectedAnswers([]);
    setShowQuizResult(false);
    setGeneratingExplanation(false);
    setIsRevealingFailed(false);
  }, [importedIdSet, learningState.knowledgePoints.length]);

  useEffect(() => {
    setShowImportResult(Boolean(importResultSummary));
  }, [importResultSummary]);

  useEffect(() => {
    let cancelled = false;

    const checkAIAssist = async () => {
      const config = getAIConfig();

      if (config.provider === 'douban') {
        const ready = Boolean(config.apiKey?.trim() && config.modelId?.trim());
        if (!cancelled) {
          setAiAssistAvailable(ready);
          setAiAssistHint(ready ? '' : '请先在设置里配置 AI');
        }
        return;
      }

      const backendReady = await checkBackendAvailable();
      if (!cancelled) {
        setAiAssistAvailable(backendReady);
        setAiAssistHint(backendReady ? '' : '请先在设置里配置 AI');
      }
    };

    void checkAIAssist();
    return () => {
      cancelled = true;
    };
  }, []);

  // 当前卡片
  const currentKp = queue[currentIdx];
  const totalCards = queue.length;
  const relatedQuestions = useMemo(
    () => (currentKp ? learningState.questions.filter(question => question.knowledgePointId === currentKp.id) : []),
    [currentKp, learningState.questions],
  );
  const currentQuizQuestion: Question | null = relatedQuestions[currentQuizIndex] ?? null;
  const todayLearningCount = useMemo(
    () => getTodayLearningProgress(learningState).totalCount,
    [learningState],
  );
  const dailyGoal = userState.user?.dailyGoal ?? 10;
  const todayGoalProgress = Math.min(100, Math.round((todayLearningCount / Math.max(dailyGoal, 1)) * 100));
  const currentExplanation = currentQuizQuestion ? getSavedExplanation(currentQuizQuestion.id) : null;
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
    const relatedQuestionsForCurrent = learningState.questions.filter(
      question => question.knowledgePointId === currentKp.id
    );

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
    learningDispatch({
      type: 'RECORD_FLASHCARD_STUDY',
      payload: {
        knowledgePointId: currentKp.id,
        score: FLASHCARD_SCORE_MAP[rating],
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
      setShowKnowledge(false);

      if (relatedQuestionsForCurrent.length > 0) {
        setCurrentQuizIndex(0);
        setSelectedAnswers([]);
        setShowQuizResult(false);
        setSessionMode('quiz');
      } else {
        moveToNext();
      }

      setIsSelecting(false);  // 解锁
    }, 200);
  }, [currentKp, isSelecting, learningDispatch, learningState.questions, learningState.todayReviewItems, moveToNext]);

  // 上一张卡片
  const goToPrev = useCallback(() => {
    if (currentIdx > 0) {
      setCurrentIdx(prev => prev - 1);
      setIsFlipped(false);
      setSessionMode('flashcard');
      setCurrentQuizIndex(0);
      setSelectedAnswers([]);
      setShowQuizResult(false);
      setSwipeDirection('up');
      setTimeout(() => setSwipeDirection(null), 200);
    }
  }, [currentIdx]);

  const handleSelectAnswer = useCallback((optionId: string) => {
    if (showQuizResult || !currentQuizQuestion) return;

    if (currentQuizQuestion.type === 'single_choice' || currentQuizQuestion.type === 'true_false') {
      setSelectedAnswers([optionId]);
      return;
    }

    setSelectedAnswers(prev =>
      prev.includes(optionId)
        ? prev.filter(id => id !== optionId)
        : [...prev, optionId]
    );
  }, [currentQuizQuestion, showQuizResult]);

  const handleSubmitQuiz = useCallback(() => {
    if (!currentKp || !currentQuizQuestion || selectedAnswers.length === 0) {
      return;
    }

    const isCorrect =
      selectedAnswers.length === currentQuizQuestion.correctAnswers.length
      && selectedAnswers.every(answer => currentQuizQuestion.correctAnswers.includes(answer));

    learningDispatch({
      type: 'RECORD_QUIZ_ANSWER',
      payload: {
        knowledgePointId: currentKp.id,
        questionId: currentQuizQuestion.id,
        correct: isCorrect,
        score: isCorrect ? 100 : 40,
      },
    });

    if (!isCorrect) {
      learningDispatch({
        type: 'ADD_WRONG_RECORD',
        payload: {
          id: `wr-${Date.now()}`,
          questionId: currentQuizQuestion.id,
          wrongAnswers: selectedAnswers,
          correctAnswers: currentQuizQuestion.correctAnswers,
          addedAt: new Date().toISOString(),
          reviewedCount: 0,
          lastReviewedAt: null,
        },
      });
    }

    setShowQuizResult(true);
  }, [currentKp, currentQuizQuestion, learningDispatch, selectedAnswers]);

  const handleFinishQuiz = useCallback(() => {
    const hasNextQuestion = currentQuizIndex < relatedQuestions.length - 1;

    if (hasNextQuestion) {
      setCurrentQuizIndex(prev => prev + 1);
      setSelectedAnswers([]);
      setShowQuizResult(false);
      setGeneratingExplanation(false);
      return;
    }

    setSessionMode('flashcard');
    setCurrentQuizIndex(0);
    setSelectedAnswers([]);
    setShowQuizResult(false);
    setGeneratingExplanation(false);
    moveToNext();
  }, [currentQuizIndex, moveToNext, relatedQuestions.length]);

  const handleGenerateExplanation = useCallback(async () => {
    if (!currentQuizQuestion || !currentKp) {
      return;
    }

    const subject = learningState.subjects.find(item => item.id === currentKp.subjectId);
    setGeneratingExplanation(true);

    try {
      await generateExplanationOnDemand(
        currentQuizQuestion.id,
        { stem: currentQuizQuestion.stem, options: currentQuizQuestion.options },
        selectedAnswers,
        currentQuizQuestion.correctAnswers,
        currentKp.name,
        subject?.name,
      );
    } finally {
      setGeneratingExplanation(false);
    }
  }, [currentKp, currentQuizQuestion, generateExplanationOnDemand, learningState.subjects, selectedAnswers]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
        case 'Enter':
          if (sessionMode === 'quiz') {
            e.preventDefault();
            if (showQuizResult) {
              handleFinishQuiz();
            } else {
              handleSubmitQuiz();
            }
            break;
          }
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
  }, [currentKp, goToPrev, handleFinishQuiz, handleSelect, handleSubmitQuiz, navigate, sessionMode, showQuizResult]);

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

      <div className="px-4 py-2" style={{ backgroundColor: theme.bgCard }}>
        <div className="rounded-xl px-3 py-3" style={{ backgroundColor: `${theme.primary}10`, border: `1px solid ${theme.primary}22` }}>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span style={{ color: theme.textSecondary }}>今日学习目标</span>
            <span style={{ color: theme.primary, fontWeight: 600 }}>
              {todayLearningCount} / {dailyGoal}
            </span>
          </div>
          <div className="mt-2 w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: theme.border }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${todayGoalProgress}%`, backgroundColor: theme.primary }}
            />
          </div>
        </div>
      </div>

      {showImportResult && importResultSummary && (
        <div className="px-4 py-2" style={{ backgroundColor: theme.bgCard }}>
          <div
            className="rounded-2xl px-4 py-3 flex items-start justify-between gap-3"
            style={{ backgroundColor: '#ecfdf5', color: '#166534', border: '1px solid #a7f3d0' }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">导入成功</div>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: '#d1fae5', color: '#065f46' }}>
                  知识点 {importResultSummary.importedKnowledgeCount} 个
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
                  题目 {importResultSummary.importedQuestionCount} 道
                </span>
                {importResultSummary.skippedQuestionCount > 0 && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                    跳过 {importResultSummary.skippedQuestionCount} 道
                  </span>
                )}
              </div>
              <div className="text-xs leading-5 mt-2">
                新导入内容已经进入本次学习队列，可直接开始闪记学习。
                {importResultSummary.skippedQuestionCount > 0 ? ' 未关联成功的题目没有写入，请回到导入页检查模板结构。' : ''}
                {' '}当前今日学习进度已累计 {todayLearningCount} / {dailyGoal}。
              </div>
            </div>
            <button
              onClick={() => setShowImportResult(false)}
              className="shrink-0 p-1 rounded-lg"
              style={{ color: '#166534' }}
              aria-label="关闭导入结果提示"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 失败卡重现提示 */}
      {isRevealingFailed && (
        <div className="px-4 py-2" style={{ backgroundColor: theme.bgCard }}>
          <div className="text-center text-xs py-1 rounded-lg" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
            📚 正在重现之前不会的卡片
          </div>
        </div>
      )}

      {/* 知识点预览按钮 - 仅在卡片模式未翻转时显示 */}
      {sessionMode === 'flashcard' && !isFlipped && (
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

          {relatedQuestions.length > 0 && (
            <div
              className="mt-2 rounded-xl p-3 text-xs"
              style={{ backgroundColor: '#ecfdf5', color: '#166534', border: '1px solid #a7f3d0' }}
            >
              本知识点关联 {relatedQuestions.length} 道题，完成卡片评分后会自动进入配套练习。
            </div>
          )}
        </div>
      )}

      {sessionMode === 'flashcard' ? (
        <>
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
        </>
      ) : currentQuizQuestion ? (
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
          <div
            className="rounded-3xl border p-5 shadow-sm"
            style={{ borderColor: `${theme.primary}30`, backgroundColor: theme.bgCard }}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="text-sm font-medium" style={{ color: theme.textSecondary }}>
                步骤 2 / 配套练习题
              </div>
              <div
                className="px-3 py-1.5 rounded-full text-sm font-semibold"
                style={{ backgroundColor: `${theme.primary}12`, color: theme.primary }}
              >
                {relatedQuestions.length > 0 ? `${currentQuizIndex + 1} / ${relatedQuestions.length}` : '1 / 1'}
              </div>
            </div>

            <div
              className="rounded-2xl px-4 py-4 mb-4"
              style={{ backgroundColor: `${theme.primary}08`, border: `1px solid ${theme.primary}18` }}
            >
              <div className="text-xs font-medium mb-2" style={{ color: theme.textMuted }}>
                题目
              </div>
              <p className="text-base font-semibold leading-7" style={{ color: theme.textPrimary }}>
                {currentQuizQuestion.stem}
              </p>
            </div>

            <div className="space-y-3">
              {currentQuizQuestion.options.map((option, index) => {
                const selected = selectedAnswers.includes(option.id);
                const isCorrectOption = currentQuizQuestion.correctAnswers.includes(option.id);
                const label = String.fromCharCode(65 + index);
                let optionBg = theme.bg;
                let optionBorder = theme.border;
                let optionText = theme.textPrimary;

                if (showQuizResult) {
                  if (isCorrectOption) {
                    optionBg = '#ecfdf5';
                    optionBorder = '#86efac';
                    optionText = '#166534';
                  } else if (selected) {
                    optionBg = '#fef2f2';
                    optionBorder = '#fca5a5';
                    optionText = '#b91c1c';
                  }
                } else if (selected) {
                  optionBg = `${theme.primary}12`;
                  optionBorder = theme.primary;
                }

                return (
                  <button
                    key={option.id}
                    onClick={() => handleSelectAnswer(option.id)}
                    disabled={showQuizResult}
                    className="w-full text-left rounded-2xl px-4 py-4 border transition-all"
                    style={{
                      backgroundColor: optionBg,
                      borderColor: optionBorder,
                      color: optionText,
                      boxShadow: selected && !showQuizResult ? '0 10px 24px -18px rgba(59,130,246,0.45)' : 'none',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm font-bold"
                        style={{
                          backgroundColor: showQuizResult
                            ? isCorrectOption
                              ? '#bbf7d0'
                              : selected
                                ? '#fecaca'
                                : theme.border
                            : selected
                              ? `${theme.primary}20`
                              : theme.border,
                          color: showQuizResult
                            ? isCorrectOption
                              ? '#166534'
                              : selected
                                ? '#b91c1c'
                                : theme.textSecondary
                            : selected
                              ? theme.primary
                              : theme.textSecondary,
                        }}
                      >
                        {label}
                      </div>
                      <div className="flex-1 pt-0.5">
                        <div className="text-base leading-7 font-medium">{option.text}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {showQuizResult && (
              <div
                className="mt-4 p-4 rounded-2xl text-sm"
                style={{
                  backgroundColor:
                    selectedAnswers.length === currentQuizQuestion.correctAnswers.length
                    && selectedAnswers.every(answer => currentQuizQuestion.correctAnswers.includes(answer))
                      ? '#ecfdf5'
                      : '#fef2f2',
                  color:
                    selectedAnswers.length === currentQuizQuestion.correctAnswers.length
                    && selectedAnswers.every(answer => currentQuizQuestion.correctAnswers.includes(answer))
                      ? '#166534'
                      : '#b91c1c',
                  border: `1px solid ${
                    selectedAnswers.length === currentQuizQuestion.correctAnswers.length
                    && selectedAnswers.every(answer => currentQuizQuestion.correctAnswers.includes(answer))
                      ? '#86efac'
                      : '#fca5a5'
                  }`,
                }}
              >
                <div className="font-semibold text-base">
                  {selectedAnswers.length === currentQuizQuestion.correctAnswers.length
                  && selectedAnswers.every(answer => currentQuizQuestion.correctAnswers.includes(answer))
                    ? '回答正确，做得不错！'
                    : `正确答案：${currentQuizQuestion.correctAnswers.join('、')}`}
                </div>
              </div>
            )}

            {showQuizResult && (
              <div className="mt-4">
                {currentExplanation ? (
                  <div
                    className="rounded-2xl p-4 border"
                    style={{ backgroundColor: '#f5f3ff', borderColor: '#ddd6fe', color: '#6b21a8' }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-base font-semibold">题目解析</div>
                      <button
                        onClick={() => {
                          const optionsText = currentQuizQuestion.options
                            .map((option, index) => `${String.fromCharCode(65 + index)}. ${option.text}`)
                            .join('\n');
                          const correctLabels = currentQuizQuestion.correctAnswers
                            .map(answer => {
                              const optionIndex = currentQuizQuestion.options.findIndex(option => option.id === answer);
                              return optionIndex >= 0 ? String.fromCharCode(65 + optionIndex) : answer;
                            })
                            .join('、');

                          navigate('ai-chat', {
                            questionContext: `题目：${currentQuizQuestion.stem}\n\n选项：\n${optionsText}\n\n正确答案：${correctLabels}\n\n解析：${currentExplanation}\n\n请进一步讲解。`,
                            subjectId: currentKp.subjectId,
                            knowledgePointId: currentKp.id,
                          });
                        }}
                        disabled={!aiAssistAvailable}
                        className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors disabled:cursor-not-allowed"
                        style={{
                          backgroundColor: aiAssistAvailable ? '#ede9fe' : '#e5e7eb',
                          color: aiAssistAvailable ? '#6d28d9' : '#9ca3af',
                        }}
                      >
                        <MessageSquare size={12} />
                        继续追问 AI
                      </button>
                    </div>
                    <div className="mt-2 leading-7 text-sm">{currentExplanation}</div>
                    {!aiAssistAvailable && (
                      <div className="mt-3 text-xs" style={{ color: '#9ca3af' }}>
                        {aiAssistHint}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <button
                      onClick={handleGenerateExplanation}
                      disabled={generatingExplanation || !aiAssistAvailable}
                      className="w-full py-3.5 rounded-2xl text-base font-medium flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: aiAssistAvailable ? '#f3e8ff' : '#e5e7eb',
                        color: aiAssistAvailable ? '#7e22ce' : '#9ca3af',
                      }}
                    >
                      {generatingExplanation ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          正在生成解析...
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          查看解析（缺失时调用 AI）
                        </>
                      )}
                    </button>
                    {!aiAssistAvailable && (
                      <div className="mt-2 text-xs text-center" style={{ color: '#9ca3af' }}>
                        {aiAssistHint}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mt-5">
              {!showQuizResult ? (
                <>
                  <button
                    onClick={() => {
                      setSessionMode('flashcard');
                      setSelectedAnswers([]);
                      setShowQuizResult(false);
                      setCurrentQuizIndex(0);
                      setGeneratingExplanation(false);
                      moveToNext();
                    }}
                    className="py-3.5 rounded-2xl text-base font-medium"
                    style={{ backgroundColor: theme.border, color: theme.textPrimary }}
                  >
                    跳过练习
                  </button>
                  <button
                    onClick={handleSubmitQuiz}
                    disabled={selectedAnswers.length === 0}
                    className="py-3.5 rounded-2xl text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: theme.primary, color: '#ffffff' }}
                  >
                    提交答案
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setSessionMode('flashcard');
                      setSelectedAnswers([]);
                      setShowQuizResult(false);
                      setCurrentQuizIndex(0);
                      setGeneratingExplanation(false);
                    }}
                    className="py-3.5 rounded-2xl text-base font-medium"
                    style={{ backgroundColor: theme.border, color: theme.textPrimary }}
                  >
                    回看卡片
                  </button>
                  <button
                    onClick={handleFinishQuiz}
                    className="py-3.5 rounded-2xl text-base font-medium"
                    style={{ backgroundColor: theme.primary, color: '#ffffff' }}
                  >
                    {currentQuizIndex < relatedQuestions.length - 1 ? '下一题' : '下一张'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
