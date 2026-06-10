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
import { ArrowLeft, ChevronLeft, ChevronRight, X, MessageSquare, Loader2, Sparkles } from 'lucide-react';
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
import type { KnowledgePointExtended, Question, ReviewItem } from '@/types';
import { getTodayLearningProgress } from '@/utils/dailyLearningProgress';
import { generateTodayReviewPlan } from '@/utils/review';
import { getReviewReminderSettings, requestReviewReminderPermission } from '@/utils/reviewReminder';

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

const POST_GOAL_GROUP_SIZE = 15;

type SessionPhase = 'import' | 'review' | 'new' | 'free';

interface FlashcardLearningPageProps {
  embedded?: boolean;
  onAskAI?: (questionContext: string) => void;
}

function isGoalRating(rating: RatingOption): boolean {
  return rating === 'good' || rating === 'easy';
}
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

function getPendingPlanIds(items: ReviewItem[], targetIds?: Set<string>): Set<string> {
  return new Set(
    items
      .filter(item => !item.completed)
      .filter(item => !targetIds || targetIds.has(item.knowledgePointId))
      .map(item => item.knowledgePointId)
  );
}
function pickSessionPlan(
  knowledgePoints: KnowledgePointExtended[],
  reviewItems: ReviewItem[],
  newItems: ReviewItem[],
  targetIds?: Set<string>,
  importIds?: Set<string>,
): { phase: SessionPhase; queue: KnowledgePointExtended[] } {
  if (importIds && importIds.size > 0) {
    return { phase: 'import', queue: buildSessionQueue(knowledgePoints, importIds) };
  }

  const pendingReviewIds = getPendingPlanIds(reviewItems, targetIds);
  if (pendingReviewIds.size > 0) {
    return { phase: 'review', queue: buildSessionQueue(knowledgePoints, pendingReviewIds) };
  }

  const pendingNewIds = getPendingPlanIds(newItems, targetIds);
  if (pendingNewIds.size > 0) {
    return { phase: 'new', queue: buildSessionQueue(knowledgePoints, pendingNewIds) };
  }

  return { phase: 'free', queue: buildSessionQueue(knowledgePoints, targetIds) };
}

export default function FlashcardLearningPage({ embedded = false, onAskAI }: FlashcardLearningPageProps) {
  const { navigate, userState } = useUser();
  const { theme } = useTheme();
  const { learningState, learningDispatch } = useLearning();
  const { getSavedExplanation, generateExplanationOnDemand } = usePreGenerate();
  const importedStudySession = learningState.importedStudySession;
  const importSessionIdsKey = importedStudySession?.knowledgePointIds.join(',') ?? '';
  const importSessionIdSet = useMemo(() => {
    if (!importedStudySession || importedStudySession.knowledgePointIds.length === 0) {
      return undefined;
    }

    return new Set(importedStudySession.knowledgePointIds);
  }, [importedStudySession]);
  // --- 学习范围（章节/科目）选择 ---
  const [selectedCategory, setSelectedCategory] = useState<{ type: 'subject' | 'chapter'; id: string } | null>(() => {
    try {
      const saved = localStorage.getItem('study-app:selected-category');
      return saved ? (JSON.parse(saved) as { type: 'subject' | 'chapter'; id: string }) : null;
    } catch { return null; }
  });
  const [, setSuppressCategoryPicker] = useState(
    () => localStorage.getItem('study-app:suppress-category-picker') === 'true',
  );
  const [showCategoryPicker, setShowCategoryPicker] = useState(() => {
    // 首次进入且未设置过分类时自动弹出选择器
    if (localStorage.getItem('study-app:suppress-category-picker') === 'true') return false;
    if (localStorage.getItem('study-app:selected-category')) return false;
    if (importedStudySession) return false;
    return true;
  });
  const [expandedSubjectInPicker, setExpandedSubjectInPicker] = useState<string | null>(null);
  const [pendingSuppressInPicker, setPendingSuppressInPicker] = useState(false);

  const categoryFilterIds = useMemo<Set<string> | undefined>(() => {
    if (!selectedCategory) return undefined;
    const kps = learningState.knowledgePoints;
    if (selectedCategory.type === 'subject') {
      return new Set(kps.filter(kp => kp.subjectId === selectedCategory.id).map(kp => kp.id));
    }
    return new Set(kps.filter(kp => kp.chapterId === selectedCategory.id).map(kp => kp.id));
    // 只在 KP 数量变化（新增/删除）或分类切换时重建，不在评分更新时重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, learningState.knowledgePoints.length]);

  // importedStudySession 优先级高于 category 过滤
  // 用于触发队列重建的稳定 key（避免评分时 effectiveTargetIds 引用变化导致误重建）
  const selectedCategoryKey = selectedCategory
    ? `${selectedCategory.type}:${selectedCategory.id}`
    : 'all';

  const sessionPlan = useMemo(
    () => pickSessionPlan(
      learningState.knowledgePoints,
      learningState.todayReviewItems,
      learningState.todayNewItems,
      categoryFilterIds,
      importSessionIdSet,
    ),
    [
      learningState.knowledgePoints,
      learningState.todayReviewItems,
      learningState.todayNewItems,
      categoryFilterIds,
      importSessionIdSet,
    ],
  );

  // 卡片翻转状态
  const [isFlipped, setIsFlipped] = useState(false);
  // 滑动方向
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);

  // 学习队列（包含所有待学习的卡片，按优先级排序）
  const [queue, setQueue] = useState<KnowledgePointExtended[]>(() => sessionPlan.queue);
  // 当前显示的卡片在队列中的索引
  const [currentIdx, setCurrentIdx] = useState(0);
  // 不会的卡片的 ID 集合（用于检测重复）
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const [sessionMode, setSessionMode] = useState<'flashcard' | 'quiz'>('flashcard');
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [showQuizResult, setShowQuizResult] = useState(false);
  const [showOptionsExpanded, setShowOptionsExpanded] = useState(true);
  const [generatingExplanation, setGeneratingExplanation] = useState(false);
  const [aiAssistAvailable, setAiAssistAvailable] = useState(false);
  const [aiAssistHint, setAiAssistHint] = useState('请先在设置里配置 AI');
  // 是否正在重现失败卡（用于显示提示）
  const [isRevealingFailed, setIsRevealingFailed] = useState(false);
  // 是否正在处理评分（用于防抖）
  const [isSelecting, setIsSelecting] = useState(false);
  // 本次 session 已完成（Good/Easy）的卡片数（不依赖 todayPlan 列表，始终可靠）
  // 使用 ref 存储最新状态，避免闭包陷阱
  const queueRef = useRef(queue);
  const failedIdsRef = useRef(failedIds);
  const currentIdxRef = useRef(currentIdx);
  const importSessionRef = useRef(importedStudySession);

  // 同步 ref
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { failedIdsRef.current = failedIds; }, [failedIds]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);
  useEffect(() => { importSessionRef.current = importedStudySession; }, [importedStudySession]);

  useEffect(() => {
    setQueue(sessionPlan.queue);
    setCurrentIdx(0);
    setFailedIds(new Set());
    setIsFlipped(false);
    setSessionMode('flashcard');
    setCurrentQuizIndex(0);
    setSelectedAnswers([]);
    setShowQuizResult(false);
    setShowOptionsExpanded(true);
    setGeneratingExplanation(false);
    setIsRevealingFailed(false);
    // 依赖稳定 key（import 变化 / 分类切换 / KP 数量变化），不因评分更新触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importSessionIdsKey, selectedCategoryKey, learningState.knowledgePoints.length, sessionPlan.phase]);

  // 进入学习页时刷新今日计划（确保 todayReviewItems / todayNewItems 是最新的）
  useEffect(() => {
    const { review, newItems } = generateTodayReviewPlan(
      learningState.knowledgePoints,
      learningState.todayNewItems,
    );
    learningDispatch({ type: 'SET_REVIEW_ITEMS', payload: { review, newItems } });
    // 只在首次 mount 时运行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!importedStudySession || learningState.isLoading) {
      return;
    }

    const hasMatchedKnowledgePoint = importedStudySession.knowledgePointIds.some(id =>
      learningState.knowledgePoints.some(kp => kp.id === id)
    );

    if (!hasMatchedKnowledgePoint) {
      learningDispatch({ type: 'CLEAR_IMPORTED_STUDY_SESSION' });
    }
  }, [importedStudySession, learningDispatch, learningState.isLoading, learningState.knowledgePoints]);

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

  // 当前分类全部掌握后，自动清除分类并重新弹出选择器
  useEffect(() => {
    if (!selectedCategory || learningState.isLoading) return;
    const kps = learningState.knowledgePoints;
    const categoryKps = selectedCategory.type === 'subject'
      ? kps.filter(kp => kp.subjectId === selectedCategory.id)
      : kps.filter(kp => kp.chapterId === selectedCategory.id);
    if (categoryKps.length > 0 && categoryKps.every(kp => kp.proficiency === 'master')) {
      setSelectedCategory(null);
      setSuppressCategoryPicker(false);
      localStorage.removeItem('study-app:selected-category');
      localStorage.removeItem('study-app:suppress-category-picker');
      setShowCategoryPicker(true);
    }
  }, [selectedCategory, learningState.knowledgePoints, learningState.isLoading]);

  // 当前卡片
  const currentKp = queue[currentIdx];
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

  // session 进度百分比（以初始队列为分母，失败卡重现时分母不变）
  const safeDailyGoal = Math.max(1, dailyGoal);
  const hasReachedDailyGoal = todayLearningCount >= safeDailyGoal;
  const extraLearningCount = Math.max(0, todayLearningCount - safeDailyGoal);
  const extraGroupNumber = Math.floor(extraLearningCount / POST_GOAL_GROUP_SIZE) + 1;
  const extraGroupCompleted = extraLearningCount % POST_GOAL_GROUP_SIZE;
  const progressLabel = hasReachedDailyGoal ? `加练第 ${extraGroupNumber} 组` : '今日目标';
  const progressValue = hasReachedDailyGoal
    ? `${extraGroupCompleted} / ${POST_GOAL_GROUP_SIZE}`
    : `${Math.min(todayLearningCount, safeDailyGoal)} / ${safeDailyGoal}`;
  const learningProgressPct = hasReachedDailyGoal
    ? Math.round((extraGroupCompleted / POST_GOAL_GROUP_SIZE) * 100)
    : Math.min(100, Math.round((todayLearningCount / safeDailyGoal) * 100));
  const currentExplanation = currentQuizQuestion ? getSavedExplanation(currentQuizQuestion.id) : null;
  // 有多少张"不会"的卡还没重现
  // 当前分类标签与进度
  const currentSubject = currentKp ? learningState.subjects.find(s => s.id === currentKp.subjectId) : null;
  const currentChapter = currentKp ? learningState.chapters.find(c => c.id === currentKp.chapterId) : null;
  const categoryLabel: string = selectedCategory?.type === 'chapter'
    ? (learningState.chapters.find(c => c.id === selectedCategory.id)?.name ?? '当前章节')
    : selectedCategory?.type === 'subject'
      ? (learningState.subjects.find(s => s.id === selectedCategory.id)?.name ?? '当前科目')
      : (currentChapter?.name ?? currentSubject?.name ?? '全部内容');

  // 选择器内各科目/章节进度（仅在打开时计算）
  const subjectProgress = useMemo(() => {
    return learningState.subjects.map(subject => {
      const kps = learningState.knowledgePoints.filter(kp => kp.subjectId === subject.id);
      const total = kps.length;
      const mastered = kps.filter(kp => kp.proficiency === 'master').length;
      const chapters = learningState.chapters
        .filter(c => c.subjectId === subject.id)
        .sort((a, b) => a.order - b.order)
        .map(chapter => {
          const chKps = kps.filter(kp => kp.chapterId === chapter.id);
          return {
            chapter,
            total: chKps.length,
            mastered: chKps.filter(kp => kp.proficiency === 'master').length,
          };
        })
        .filter(cp => cp.total > 0);
      return { subject, total, mastered, chapters };
    }).filter(sp => sp.total > 0);
  }, [learningState.subjects, learningState.chapters, learningState.knowledgePoints]);

  const exitLearning = useCallback(() => {
    if (importSessionRef.current) {
      learningDispatch({ type: 'CLEAR_IMPORTED_STUDY_SESSION' });
    }
    navigate('home');
  }, [learningDispatch, navigate]);

  const openCategoryPicker = useCallback(() => {
    setExpandedSubjectInPicker(null);
    setPendingSuppressInPicker(false);
    setShowCategoryPicker(true);
  }, []);

  const handleCategoryConfirm = useCallback((category: { type: 'subject' | 'chapter'; id: string } | null) => {
    setSelectedCategory(category);
    if (category) {
      localStorage.setItem('study-app:selected-category', JSON.stringify(category));
    } else {
      localStorage.removeItem('study-app:selected-category');
    }
    if (pendingSuppressInPicker) {
      setSuppressCategoryPicker(true);
      localStorage.setItem('study-app:suppress-category-picker', 'true');
    }
    setPendingSuppressInPicker(false);
    setShowCategoryPicker(false);
  }, [pendingSuppressInPicker]);

  const handleCategoryPickerDone = useCallback(() => {
    if (pendingSuppressInPicker) {
      setSuppressCategoryPicker(true);
      localStorage.setItem('study-app:suppress-category-picker', 'true');
    }
    setPendingSuppressInPicker(false);
    setShowCategoryPicker(false);
  }, [pendingSuppressInPicker]);

  // 预览当前卡片在不同评分下的结果
  const currentPreview = useMemo(() => {
    if (!currentKp) return null;
    const cardInput = knowledgePointToCardInput(currentKp);
    return previewCard(cardInput);
  }, [currentKp]);

  // 翻转卡片
  const handleFlip = useCallback(() => {
    setIsFlipped(prev => !prev);
    // 保留知识点入口，避免翻转后页面高度突变
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
      if (importSessionRef.current) {
        learningDispatch({ type: 'CLEAR_IMPORTED_STUDY_SESSION' });
      }
    }
  }, [learningDispatch]);

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

    // 更新 FSRS 字段（同时递增 reviewCount，确保卡片不再被误判为全新卡）
    const fsrsUpdates = cardToFsrsFields(result.card);
    learningDispatch({
      type: 'UPDATE_FSRS_CARD',
      payload: {
        knowledgePointId: currentKp.id,
        updates: {
          ...fsrsUpdates,
          proficiency: result.card.state === 2 ? 'normal' : currentKp.proficiency,
          reviewCount: (currentKp.reviewCount ?? 0) + 1,
        },
      },
    });
    const countsForGoal = isGoalRating(rating);
    if (countsForGoal) {
      learningDispatch({
        type: 'RECORD_FLASHCARD_STUDY',
        payload: {
          knowledgePointId: currentKp.id,
          score: FLASHCARD_SCORE_MAP[rating],
        },
      });
      if (!getReviewReminderSettings().prompted) {
        void requestReviewReminderPermission();
      }
    }

    // 完成当日计划项（复习项或新学项都要标记）
    const isInTodayPlan =
      learningState.todayReviewItems.some(r => r.knowledgePointId === currentKp.id) ||
      learningState.todayNewItems.some(r => r.knowledgePointId === currentKp.id);
    if (countsForGoal && isInTodayPlan) {
      learningDispatch({ type: 'COMPLETE_REVIEW_ITEM', payload: currentKp.id });
    }

    // session 本地计数：Good/Easy 才算"过了这张"
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

    // 延迟后跳转到下一张
    setTimeout(() => {
      setIsFlipped(false);
      setSwipeDirection(null);

      if (relatedQuestionsForCurrent.length > 0) {
        setCurrentQuizIndex(0);
        setSelectedAnswers([]);
        setShowQuizResult(false);
        setShowOptionsExpanded(true);
        setSessionMode('quiz');
      } else {
        moveToNext();
      }

      setIsSelecting(false);  // 解锁
    }, 200);
  }, [currentKp, isSelecting, learningDispatch, learningState.questions, learningState.todayReviewItems, learningState.todayNewItems, moveToNext]);

  // 上一张卡片
  const goToPrev = useCallback(() => {
    if (currentIdx > 0) {
      setCurrentIdx(prev => prev - 1);
      setIsFlipped(false);
      setSessionMode('flashcard');
      setCurrentQuizIndex(0);
      setSelectedAnswers([]);
      setShowQuizResult(false);
      setShowOptionsExpanded(true);
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
    setShowOptionsExpanded(false);
  }, [currentKp, currentQuizQuestion, learningDispatch, selectedAnswers]);

  const handleFinishQuiz = useCallback(() => {
    const hasNextQuestion = currentQuizIndex < relatedQuestions.length - 1;

    if (hasNextQuestion) {
      setCurrentQuizIndex(prev => prev + 1);
      setSelectedAnswers([]);
      setShowQuizResult(false);
      setShowOptionsExpanded(true);
      setGeneratingExplanation(false);
      return;
    }

    setSessionMode('flashcard');
    setCurrentQuizIndex(0);
    setSelectedAnswers([]);
    setShowQuizResult(false);
    setShowOptionsExpanded(true);
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
          if (!isFlipped) break;
          handleSelect('again');
          break;
        case '2':
        case 'h':
        case 'H':
          if (!isFlipped) break;
          handleSelect('hard');
          break;
        case '3':
        case 'g':
        case 'G':
          if (!isFlipped) break;
          handleSelect('good');
          break;
        case '4':
        case 'e':
        case 'E':
          if (!isFlipped) break;
          if (currentKp && shouldShowEasy(knowledgePointToCardInput(currentKp))) {
            handleSelect('easy');
          }
          break;
        case 'ArrowLeft':
          goToPrev();
          break;
        case 'Escape':
          exitLearning();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentKp, exitLearning, goToPrev, handleFinishQuiz, handleSelect, handleSubmitQuiz, isFlipped, sessionMode, showQuizResult]);

  const desktopStageClassName = embedded
    ? 'relative mx-auto flex h-full w-full items-stretch justify-center'
    : 'relative mx-auto flex h-full w-full max-w-[1180px] items-stretch justify-center md:items-center';
  const desktopShellClassName = embedded
    ? 'relative z-10 flex h-full w-full max-w-[1180px] flex-col overflow-hidden rounded-[28px] border shadow-sm'
    : 'relative z-10 flex h-full w-full flex-col overflow-hidden md:max-h-full md:max-w-[480px] md:rounded-[32px] md:border md:shadow-[0_24px_80px_rgba(15,23,42,0.16)]';
  const desktopShellStyle = {
    backgroundColor: embedded ? '#ffffff' : theme.bg,
    borderColor: embedded ? '#e2e8f0' : theme.border,
  } as const;
  const desktopBackdropStyle = {
    backgroundColor: embedded ? 'transparent' : theme.bg,
    backgroundImage: embedded ? 'none' : `radial-gradient(circle at top, ${theme.primary}16 0%, transparent 38%), linear-gradient(180deg, ${theme.bg} 0%, ${theme.bgCard} 100%)`,
  } as const;
  const desktopGlowStyle = {
    background: `radial-gradient(circle, ${theme.primary}18 0%, transparent 72%)`,
  } as const;

  // 无卡片时

  if (!currentKp || queue.length === 0) {
    return (
      <div
        className={embedded ? 'relative h-full min-h-0 overflow-hidden' : 'fixed inset-0 z-50 md:p-5 lg:p-6'}
        style={desktopBackdropStyle}
      >
        <div className={desktopStageClassName}>
          <div
            className="pointer-events-none absolute inset-x-0 top-1/2 hidden h-[520px] -translate-y-1/2 md:block"
            style={desktopGlowStyle}
          />
          <div className={desktopShellClassName} style={desktopShellStyle}>
            <div className="flex items-center justify-center h-full">
              <div className="text-center px-6">
                <div className="text-6xl mb-6">🎉</div>
                <h2 className="text-2xl font-bold mb-3" style={{ color: theme.textPrimary }}>
                  全部学完了！
                </h2>
                <p className="text-base mb-8" style={{ color: theme.textSecondary }}>
                  当前范围的知识点已全部完成
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={openCategoryPicker}
                    className="px-8 py-3 rounded-xl font-medium"
                    style={{ backgroundColor: `${theme.primary}15`, color: theme.primary }}
                  >
                    选择其他章节
                  </button>
                  <button
                    onClick={exitLearning}
                    className="px-8 py-3 rounded-xl font-medium text-white"
                    style={{ backgroundColor: theme.primary }}
                  >
                    返回首页
                  </button>
                </div>
              </div>
            </div>
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

  return (
    <div
      className={embedded ? 'relative h-full min-h-0 overflow-hidden' : 'fixed inset-0 z-50 md:p-5 lg:p-6'}
      style={desktopBackdropStyle}
    >
      <div className={desktopStageClassName}>
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 hidden h-[560px] -translate-y-1/2 md:block"
          style={desktopGlowStyle}
        />
        <div className={desktopShellClassName} style={desktopShellStyle}>
          {/* Header */}
          <div className="shrink-0 px-4 py-3 md:px-6 md:py-4" style={{ backgroundColor: theme.bgCard }}>
            <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={exitLearning}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]"
              aria-label="返回"
            >
              <ArrowLeft size={19} />
            </button>
            {/* 分类选择 chip */}
            <button
              onClick={openCategoryPicker}
              className="flex h-10 min-w-0 max-w-[220px] items-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition-colors hover:bg-indigo-50"
              style={{ backgroundColor: '#ffffff', borderColor: '#c7d2fe', color: theme.primary }}
            >
              <span className="truncate">
                {categoryLabel}
              </span>
              <ChevronRight size={14} className="shrink-0 rotate-90" />
            </button>
            <div className="flex min-w-[180px] flex-1 items-center gap-3 md:ml-auto md:max-w-[520px]">
              <div className="shrink-0 text-sm font-semibold text-slate-600">
                {progressLabel}
              </div>
              <div className="h-2 min-w-[120px] flex-1 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${learningProgressPct}%`,
                    backgroundColor: hasReachedDailyGoal ? '#10b981' : theme.primary,
                  }}
                />
              </div>
              <div className="shrink-0 text-sm font-extrabold" style={{ color: hasReachedDailyGoal ? '#10b981' : theme.primary }}>
                {progressValue}
              </div>
            </div>
            </div>
          </div>

          {/* 本次 session 进度条 */}

          {/* 失败卡重现提示 */}
          {isRevealingFailed && (
            <div className="px-4 py-2 md:px-6" style={{ backgroundColor: theme.bgCard }}>
              <div className="text-center text-xs py-1 rounded-lg" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                📚 正在重现之前不会的卡片
              </div>
            </div>
          )}

          {sessionMode === 'flashcard' ? (
            <>
              {/* Card area with side navigation */}
              <div className="relative flex min-h-0 flex-1 items-center px-3 py-4 md:px-8 md:py-5">
                {/* Left button - previous */}
                <button
                  onClick={goToPrev}
                  disabled={currentIdx === 0}
                  className="absolute left-2 z-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 shadow-sm transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 md:left-6"
                  aria-label="Previous card"
                >
                  <ChevronLeft size={24} />
                </button>

                {/* Card */}
                <div className={`flex min-h-0 flex-1 items-center justify-center ${embedded ? 'px-14 py-2' : 'px-12 py-2'}`}>
                  <FlashcardCard
                    name={currentKp.name}
                    explanation={currentKp.explanation || '暂无解析'}
                    memoryTip={currentKp.memoryTip}
                    isFlipped={isFlipped}
                    onFlip={handleFlip}
                    swipeDirection={swipeDirection}
                    size={embedded ? 'desktop' : 'default'}
                  />
                </div>

                {/* Right button - flip affordance */}
                <button
                  onClick={handleFlip}
                  className="absolute right-2 z-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 shadow-sm transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-95 md:right-6"
                  aria-label="Flip card"
                >
                  <ChevronRight size={24} />
                </button>
              </div>

              {/* Rating buttons */}
              <div className="min-h-[112px] shrink-0 px-4 pb-4 md:px-8">
                {!isFlipped ? (
                  <button
                    onClick={handleFlip}
                    className="mx-auto flex h-14 w-full max-w-[520px] items-center justify-center gap-2 rounded-2xl text-base font-bold text-white transition-colors hover:bg-indigo-800 active:scale-[0.98]"
                    style={{
                      backgroundColor: '#3730a3',
                      boxShadow: `0 14px 26px ${theme.primary}22`,
                    }}
                  >
                    查看答案
                    <ChevronRight size={18} />
                  </button>
                ) : (
                  <div className="mx-auto grid max-w-[720px] grid-cols-4 gap-2">
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
                      className={`py-3 px-1 rounded-xl font-medium text-center transition-transform active:scale-95 flex flex-col items-center border-2 ${showEasy ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
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
                )}

                {/* Relearning 状态提示 */}
                {isFlipped && currentPreview && (currentPreview[Rating.Again]?.isRelearning || currentPreview[Rating.Hard]?.isRelearning) && (
                  <div className="mt-2 text-xs text-center py-1 rounded-lg" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                    🔄 进入重新学习模式
                  </div>
                )}

                {/* Keyboard hints */}
                <div className="mt-3 flex justify-center gap-4 text-xs text-slate-500">
                  {isFlipped && <span>1/2/3/4</span>}
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
                  {/* 已作答时显示折叠/展开控制条 */}
                  {showQuizResult && (
                    <button
                      onClick={() => setShowOptionsExpanded(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl text-sm font-medium transition-all"
                      style={{
                        backgroundColor: (() => {
                          const isCorrect = selectedAnswers.length === currentQuizQuestion.correctAnswers.length
                            && selectedAnswers.every(a => currentQuizQuestion.correctAnswers.includes(a));
                          return isCorrect ? '#ecfdf5' : '#fef2f2';
                        })(),
                        color: (() => {
                          const isCorrect = selectedAnswers.length === currentQuizQuestion.correctAnswers.length
                            && selectedAnswers.every(a => currentQuizQuestion.correctAnswers.includes(a));
                          return isCorrect ? '#166534' : '#b91c1c';
                        })(),
                        border: `1px solid ${(() => {
                          const isCorrect = selectedAnswers.length === currentQuizQuestion.correctAnswers.length
                            && selectedAnswers.every(a => currentQuizQuestion.correctAnswers.includes(a));
                          return isCorrect ? '#86efac' : '#fca5a5';
                        })()}`,
                      }}
                    >
                      <span>
                        {(() => {
                          const isCorrect = selectedAnswers.length === currentQuizQuestion.correctAnswers.length
                            && selectedAnswers.every(a => currentQuizQuestion.correctAnswers.includes(a));
                          return isCorrect ? '✓ 回答正确' : `✗ 正确答案：${currentQuizQuestion.correctAnswers.map(id => {
                            const idx = currentQuizQuestion.options.findIndex(o => o.id === id);
                            return idx >= 0 ? String.fromCharCode(65 + idx) : id;
                          }).join('、')}`;
                        })()}
                      </span>
                      <span className="text-xs opacity-60">{showOptionsExpanded ? '收起选项 ↑' : '查看选项 ↓'}</span>
                    </button>
                  )}
                  {/* 选项列表：未作答时始终显示，已作答后按展开状态显示 */}
                  {(!showQuizResult || showOptionsExpanded) && currentQuizQuestion.options.map((option, index) => {
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

                {/* 正确/错误结果提示（已折叠为顶部控制条，不再单独显示） */}

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

                              const questionContext = `题目：${currentQuizQuestion.stem}\n\n选项：\n${optionsText}\n\n正确答案：${correctLabels}\n\n解析：${currentExplanation}\n\n请进一步讲解。`;
                              if (embedded && onAskAI) {
                                onAskAI(questionContext);
                                return;
                              }
                              navigate('ai-chat', {
                                questionContext,
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
                          setShowOptionsExpanded(true);
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
                          setShowOptionsExpanded(true);
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
      </div>

      {/* ===== 分类选择器底部弹层 ===== */}
      {showCategoryPicker && (
        <div
          className={`${embedded ? 'absolute' : 'fixed'} inset-0 z-[60] flex flex-col justify-end`}
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowCategoryPicker(false); }}
        >
          <div
            className="rounded-t-3xl max-h-[80vh] flex flex-col"
            style={{ backgroundColor: theme.bg, boxShadow: '0 -8px 32px rgba(0,0,0,0.18)' }}
          >
            {/* 弹层顶部 */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
              <h2 className="text-base font-bold" style={{ color: theme.textPrimary }}>选择学习范围</h2>
              <button
                onClick={() => setShowCategoryPicker(false)}
                className="p-1.5 rounded-full"
                style={{ backgroundColor: theme.border, color: theme.textSecondary }}
              >
                <X size={16} />
              </button>
            </div>

            {/* 列表区（可滚动） */}
            <div className="overflow-y-auto flex-1 px-4 pb-2">
              {/* 全部内容 */}
              <button
                onClick={() => handleCategoryConfirm(null)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl mb-2 border-2 transition-all active:opacity-70"
                style={{
                  backgroundColor: !selectedCategory ? `${theme.primary}12` : theme.bgCard,
                  borderColor: !selectedCategory ? theme.primary : theme.border,
                }}
              >
                <span className="text-sm font-semibold" style={{ color: !selectedCategory ? theme.primary : theme.textPrimary }}>
                  全部内容
                </span>
                <span className="text-xs" style={{ color: theme.textMuted }}>
                  {learningState.knowledgePoints.filter(kp => kp.proficiency !== 'master').length} 待学
                </span>
              </button>

              {/* 各科目 */}
              {subjectProgress.map(({ subject, total, mastered, chapters }) => {
                const isExpanded = expandedSubjectInPicker === subject.id;
                const subjectSelected = selectedCategory?.type === 'subject' && selectedCategory.id === subject.id;
                const pending = total - mastered;
                return (
                  <div key={subject.id} className="mb-2">
                    {/* 科目行 */}
                    <div
                      className="flex items-center gap-2 px-4 py-3 rounded-2xl border-2 transition-all"
                      style={{
                        backgroundColor: subjectSelected ? `${theme.primary}12` : theme.bgCard,
                        borderColor: subjectSelected ? theme.primary : theme.border,
                      }}
                    >
                      <button
                        onClick={() => handleCategoryConfirm({ type: 'subject', id: subject.id })}
                        className="flex-1 flex items-center gap-2 text-left"
                      >
                        <span className="text-base">{subject.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate" style={{ color: subjectSelected ? theme.primary : theme.textPrimary }}>
                            {subject.name}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
                            {mastered}/{total} 已掌握 · {pending} 待学
                          </div>
                        </div>
                      </button>
                      {chapters.length > 0 && (
                        <button
                          onClick={() => setExpandedSubjectInPicker(isExpanded ? null : subject.id)}
                          className="shrink-0 p-1.5 rounded-lg transition-colors"
                          style={{ backgroundColor: `${theme.primary}10`, color: theme.primary }}
                        >
                          <ChevronRight
                            size={14}
                            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                          />
                        </button>
                      )}
                    </div>

                    {/* 章节列表 */}
                    {isExpanded && chapters.map(({ chapter, total: chTotal, mastered: chMastered }) => {
                      const chPending = chTotal - chMastered;
                      const chSelected = selectedCategory?.type === 'chapter' && selectedCategory.id === chapter.id;
                      return (
                        <button
                          key={chapter.id}
                          onClick={() => handleCategoryConfirm({ type: 'chapter', id: chapter.id })}
                          className="w-full flex items-center justify-between pl-8 pr-4 py-2.5 mt-1 rounded-xl border transition-all active:opacity-70"
                          style={{
                            backgroundColor: chSelected ? `${theme.primary}10` : `${theme.bgCard}cc`,
                            borderColor: chSelected ? theme.primary : theme.border,
                          }}
                        >
                          <span className="text-sm text-left truncate" style={{ color: chSelected ? theme.primary : theme.textPrimary }}>
                            {chapter.name}
                          </span>
                          <span className="text-xs shrink-0 ml-2" style={{ color: theme.textMuted }}>
                            {chMastered}/{chTotal} · {chPending}待
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* 底部操作区 */}
            <div className="px-5 pt-3 pb-6 shrink-0 border-t" style={{ borderColor: theme.border }}>
              <button
                onClick={() => setPendingSuppressInPicker(p => !p)}
                className="flex items-center gap-2 mb-4 active:opacity-70"
              >
                <div
                  className="w-5 h-5 rounded flex items-center justify-center border-2 shrink-0"
                  style={{
                    backgroundColor: pendingSuppressInPicker ? theme.primary : 'transparent',
                    borderColor: pendingSuppressInPicker ? theme.primary : theme.border,
                  }}
                >
                  {pendingSuppressInPicker && <span className="text-white text-xs font-bold">✓</span>}
                </div>
                <span className="text-sm" style={{ color: theme.textSecondary }}>不再自动弹出此选择器</span>
              </button>
              <button
                onClick={handleCategoryPickerDone}
                className="w-full py-3.5 rounded-2xl text-base font-semibold"
                style={{ backgroundColor: theme.primary, color: '#fff' }}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
