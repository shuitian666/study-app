import { useState, useMemo, useEffect, useRef } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { PageHeader, ProficiencyBadge } from '@/components/ui/Common';
import FlashcardCard from '@/components/ui/FlashcardCard';
import { usePreGenerate } from '@/hooks/usePreGenerate';
import { PROFICIENCY_MAP } from '@/types';
import type { ProficiencyLevel } from '@/types';
import type { Question } from '@/types';
import { ChevronRight, CheckCircle, ArrowRight, Sparkles, XCircle, Loader2, MessageSquare } from 'lucide-react';

export default function ReviewSessionPage() {
  const { userState, navigate } = useUser();
  const { learningState, learningDispatch } = useLearning();
  const { theme } = useTheme();

  // 动画效果 - 使用次级界面动画设置
  const [animationEffect, setAnimationEffect] = useState(() => {
    const saved = localStorage.getItem('sub-animation-effect');
    return saved || 'fade-in';
  });

  // 监听动画效果变化
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sub-animation-effect' && e.newValue) {
        setAnimationEffect(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 获取动画类名
  const getAnimationClass = (delay: number) => {
    const baseClass = `scroll-${animationEffect}`;
    const delayClass = `reveal-delay-${delay}`;
    return `${baseClass} ${delayClass}`;
  };

  const reviewType = userState.pageParams.type ?? 'review';
  const items = reviewType === 'review' ? learningState.todayReviewItems : learningState.todayNewItems;
  const pendingItems = items.filter(r => !r.completed);

  const knowledgePoints = useMemo(() =>
    pendingItems.map(item => learningState.knowledgePoints.find(k => k.id === item.knowledgePointId)).filter(Boolean),
    [pendingItems, learningState.knowledgePoints]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [showNextOption, setShowNextOption] = useState(false);
  const [sessionMode, setSessionMode] = useState<'rate' | 'quiz' | 'revisit'>('rate');
  const [currentQuizQuestion, setCurrentQuizQuestion] = useState<Question | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [showQuizResult, setShowQuizResult] = useState(false);
  const [generatingExplanation, setGeneratingExplanation] = useState(false);
  const [pendingNoQuestionIds, setPendingNoQuestionIds] = useState<string[]>([]);
  const [activeRevisitId, setActiveRevisitId] = useState<string | null>(null);
  const [resumeIndexAfterRevisit, setResumeIndexAfterRevisit] = useState<number | null>(null);
  const [quizSolvedCount, setQuizSolvedCount] = useState(0);
  const hasAutoNavigated = useRef(false);
  const { getSavedExplanation, generateExplanationOnDemand } = usePreGenerate();

  const hasNewItems = learningState.todayNewItems.filter(r => !r.completed).length > 0;
  const hasReviewItems = learningState.todayReviewItems.filter(r => !r.completed).length > 0;

  useEffect(() => {
    if (userState.currentPage !== 'review-session') return;
    if (hasAutoNavigated.current) return;

    if (knowledgePoints.length === 0) {
      hasAutoNavigated.current = true;
      if (reviewType === 'review' && hasNewItems) {
        navigate('review-session', { type: 'new' });
      } else if (reviewType === 'new' && hasReviewItems) {
        navigate('review-session', { type: 'review' });
      }
    }

    return () => {
      hasAutoNavigated.current = false;
    };
  }, [knowledgePoints.length, reviewType, hasNewItems, hasReviewItems, navigate, userState.currentPage]);

  useEffect(() => {
    if (currentIndex >= knowledgePoints.length && knowledgePoints.length > 0) {
      setCurrentIndex(knowledgePoints.length - 1);
    } else if (knowledgePoints.length === 0) {
      setCurrentIndex(0);
    }
  }, [knowledgePoints.length]);

  useEffect(() => {
    setSessionMode('rate');
    setShowNextOption(false);
    setSelectedAnswers([]);
    setShowQuizResult(false);
    setCurrentQuizQuestion(null);
    setIsCardFlipped(false);
  }, [currentIndex, reviewType]);

  useEffect(() => {
    setIsCardFlipped(false);
  }, [sessionMode]);

  const currentKP = knowledgePoints[currentIndex];
  const currentExplanation = currentQuizQuestion ? getSavedExplanation(currentQuizQuestion.id) : null;

  const activeRevisitKP = useMemo(
    () => learningState.knowledgePoints.find(k => k.id === activeRevisitId),
    [learningState.knowledgePoints, activeRevisitId]
  );

  const beginRevisitIfDue = (
    pendingIds: string[],
    solvedCount: number,
    nextIndex: number | null
  ): boolean => {
    if (reviewType !== 'new') return false;
    if (pendingIds.length === 0) return false;

    const shouldInsert = solvedCount > 0 && solvedCount % 3 === 0;
    const isSessionEnding = nextIndex === null;
    if (!shouldInsert && !isSessionEnding) return false;

    const [nextRevisitId, ...rest] = pendingIds;
    setPendingNoQuestionIds(rest);
    setActiveRevisitId(nextRevisitId);
    setResumeIndexAfterRevisit(nextIndex);
    setSessionMode('revisit');
    setShowNextOption(false);
    return true;
  };

  const goToNextKnowledge = (
    pendingIds: string[] = pendingNoQuestionIds,
    solvedCount: number = quizSolvedCount
  ) => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < knowledgePoints.length) {
      if (beginRevisitIfDue(pendingIds, solvedCount, nextIndex)) return;
      setCurrentIndex(nextIndex);
      return;
    }

    if (beginRevisitIfDue(pendingIds, solvedCount, null)) return;

    const hasNewItemsLeft = learningState.todayNewItems.filter(r => !r.completed).length > 0;
    if (reviewType === 'review' && hasNewItemsLeft) {
      navigate('review-session', { type: 'new' });
    } else {
      navigate('home');
    }
  };

  const handleRate = (level: ProficiencyLevel) => {
    if (!currentKP) return;

    const relatedQuestionsForCurrent = learningState.questions.filter(q => q.knowledgePointId === currentKP.id);

    learningDispatch({ type: 'UPDATE_PROFICIENCY', payload: { id: currentKP.id, proficiency: level } });
    learningDispatch({ type: 'COMPLETE_REVIEW_ITEM', payload: currentKP.id });
    hasAutoNavigated.current = false;

    if (reviewType === 'new') {
      if (relatedQuestionsForCurrent.length > 0) {
        setCurrentQuizQuestion(relatedQuestionsForCurrent[0]);
        setSelectedAnswers([]);
        setShowQuizResult(false);
        setSessionMode('quiz');
        return;
      }

      const nextPendingIds = pendingNoQuestionIds.includes(currentKP.id)
        ? pendingNoQuestionIds
        : [...pendingNoQuestionIds, currentKP.id];
      setPendingNoQuestionIds(nextPendingIds);
      goToNextKnowledge(nextPendingIds, quizSolvedCount);
      return;
    }

    setShowNextOption(true);
  };

  const handleSelectAnswer = (optionId: string) => {
    if (showQuizResult || !currentQuizQuestion) return;
    if (currentQuizQuestion.type === 'single_choice') {
      setSelectedAnswers([optionId]);
      return;
    }

    setSelectedAnswers(prev =>
      prev.includes(optionId)
        ? prev.filter(id => id !== optionId)
        : [...prev, optionId]
    );
  };

  const handleSubmitQuiz = () => {
    if (!currentKP || !currentQuizQuestion || selectedAnswers.length === 0) return;
    const isCorrect =
      selectedAnswers.length === currentQuizQuestion.correctAnswers.length &&
      selectedAnswers.every(a => currentQuizQuestion.correctAnswers.includes(a));

    learningDispatch({
      type: 'RECORD_QUIZ_ANSWER',
      payload: {
        knowledgePointId: currentKP.id,
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
  };

  const handleGenerateExplanation = async () => {
    if (!currentQuizQuestion || !currentKP) return;
    setGeneratingExplanation(true);
    const subject = learningState.subjects.find(s => s.id === currentKP.subjectId);

    try {
      await generateExplanationOnDemand(
        currentQuizQuestion.id,
        { stem: currentQuizQuestion.stem, options: currentQuizQuestion.options },
        selectedAnswers,
        currentQuizQuestion.correctAnswers,
        currentKP.name,
        subject?.name,
      );
    } finally {
      setGeneratingExplanation(false);
    }
  };

  const handleFinishQuiz = () => {
    const nextSolvedCount = quizSolvedCount + 1;
    setQuizSolvedCount(nextSolvedCount);
    setSessionMode('rate');
    setSelectedAnswers([]);
    setShowQuizResult(false);
    setCurrentQuizQuestion(null);
    goToNextKnowledge(pendingNoQuestionIds, nextSolvedCount);
  };

  const handleFinishRevisit = () => {
    setSessionMode('rate');
    setActiveRevisitId(null);
    const targetIndex = resumeIndexAfterRevisit;
    setResumeIndexAfterRevisit(null);

    if (targetIndex !== null && targetIndex < knowledgePoints.length) {
      setCurrentIndex(targetIndex);
      return;
    }

    if (pendingNoQuestionIds.length > 0) {
      beginRevisitIfDue(pendingNoQuestionIds, quizSolvedCount, null);
      return;
    }

    navigate('home');
  };

  const handleNextAction = (action: 'continue' | 'next_stage' | 'quiz') => {
    setShowNextOption(false);

    if (action === 'continue') {
      if (currentIndex < knowledgePoints.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        const hasNewItems = learningState.todayNewItems.filter(r => !r.completed).length > 0;
        if (reviewType === 'review' && hasNewItems) {
          navigate('review-session', { type: 'new' });
        } else {
          navigate('home');
        }
      }
    } else if (action === 'next_stage') {
      const nextType = reviewType === 'review' ? 'new' : 'review';
      navigate('review-session', { type: nextType });
    } else if (action === 'quiz') {
      if (currentKP) {
        navigate('quiz-session', { subjectId: currentKP.subjectId, knowledgePointId: currentKP.id });
      }
    }
    hasAutoNavigated.current = false;
  };

  if (knowledgePoints.length === 0) {
    return (
      <div>
        <PageHeader title={reviewType === 'review' ? '复习' : '新学'} onBack={() => navigate('home')} />
        <div className="flex flex-col items-center justify-center py-20 px-8">
          <span className="text-5xl mb-4">🎉</span>
          <p className="font-medium" style={{ color: theme.textSecondary }}>
            {reviewType === 'review' ? '今日复习已全部完成！' : '今日新学已全部完成！'}
          </p>
          <button
            onClick={() => navigate('home')}
            className="mt-4 px-6 py-2 rounded-xl text-sm"
            style={{ backgroundColor: theme.primary, color: '#ffffff' }}
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  if (!currentKP) {
    setCurrentIndex(0);
    return (
      <div>
        <PageHeader title="加载中..." onBack={() => navigate('home')} />
        <div className="flex flex-col items-center justify-center py-20 px-8">
          <span className="text-5xl mb-4">⏳</span>
          <p className="font-medium" style={{ color: theme.textSecondary }}>正在加载...</p>
        </div>
      </div>
    );
  }

  const subject = learningState.subjects.find(s => s.id === currentKP.subjectId);
  const relatedQuestions = learningState.questions.filter(q => q.knowledgePointId === currentKP.id);
  const isLastItem = currentIndex === knowledgePoints.length - 1;
  const nextStageLabel = reviewType === 'review' ? '新学内容' : '复习内容';
  const hasNextStage = reviewType === 'review'
    ? learningState.todayNewItems.filter(r => !r.completed).length > 0
    : learningState.todayReviewItems.filter(r => !r.completed).length > 0;

  return (
    <div className="page-scroll pb-4">
      <PageHeader
        title={`${reviewType === 'review' ? '复习' : '新学'} ${currentIndex + 1}/${knowledgePoints.length}`}
        onBack={() => navigate('home')}
      />

      <div className={`px-4 pt-2 ${getAnimationClass(1)}`}>
        <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ backgroundColor: theme.border }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / knowledgePoints.length) * 100}%`, backgroundColor: theme.primary }}
          />
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="rounded-xl px-3 py-2 text-xs" style={{ backgroundColor: `${theme.primary}12`, color: theme.primary }}>
          流程：先看知识卡片，再做配套练习。无配套题的知识点会在间隔后自动回顾一次。
        </div>
      </div>

      {sessionMode !== 'quiz' && (
      <div className="px-4 pt-4">
        <div className="rounded-2xl p-5 border shadow-sm" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-xs mb-1" style={{ color: theme.textMuted }}>{subject?.icon} {subject?.name}</div>
              <h2 className="text-base font-bold" style={{ color: theme.textPrimary }}>
                {reviewType === 'review' ? '复习知识卡片' : '新学知识卡片'}
              </h2>
            </div>
            <ProficiencyBadge level={currentKP.proficiency} />
          </div>

          <FlashcardCard
            name={currentKP.name}
            explanation={currentKP.explanation || '暂无解析'}
            memoryTip={currentKP.memoryTip}
            isFlipped={isCardFlipped}
            onFlip={() => setIsCardFlipped(prev => !prev)}
          />

          {relatedQuestions.length > 0 && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: theme.border }}>
              <div className="text-xs mb-2" style={{ color: theme.textMuted }}>关联例题</div>
              <button
                onClick={() => navigate('quiz-session', { subjectId: currentKP.subjectId, knowledgePointId: currentKP.id })}
                className="w-full rounded-lg p-3 text-left flex items-center justify-between"
                style={{ backgroundColor: theme.border }}
              >
                <span className="text-xs truncate" style={{ color: theme.textSecondary }}>{relatedQuestions[0].stem}</span>
                <ChevronRight size={14} style={{ color: theme.textMuted }} />
              </button>
            </div>
          )}

        </div>
      </div>
      )}

      {reviewType === 'new' && sessionMode === 'quiz' && currentQuizQuestion && (
        <div className="px-4 pt-4">
          <div className="rounded-2xl border p-4" style={{ borderColor: `${theme.primary}35`, backgroundColor: `${theme.primary}08` }}>
            <div className="text-xs mb-2" style={{ color: theme.textMuted }}>步骤 2 / 配套练习题</div>
            <p className="text-sm font-medium mb-3" style={{ color: theme.textPrimary }}>{currentQuizQuestion.stem}</p>

            <div className="space-y-2">
              {currentQuizQuestion.options.map((opt, index) => {
                const selected = selectedAnswers.includes(opt.id);
                const isCorrectOption = currentQuizQuestion.correctAnswers.includes(opt.id);
                const label = String.fromCharCode(65 + index);
                let optionBg = theme.bgCard;
                let optionBorder = theme.border;

                if (showQuizResult) {
                  if (isCorrectOption) {
                    optionBg = '#ecfdf5';
                    optionBorder = '#86efac';
                  } else if (selected) {
                    optionBg = '#fef2f2';
                    optionBorder = '#fca5a5';
                  }
                } else if (selected) {
                  optionBg = `${theme.primary}12`;
                  optionBorder = theme.primary;
                }

                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectAnswer(opt.id)}
                    disabled={showQuizResult}
                    className="w-full text-left rounded-lg px-3 py-2 border text-sm"
                    style={{
                      backgroundColor: optionBg,
                      borderColor: optionBorder,
                      color: theme.textPrimary,
                    }}
                  >
                    {label}. {opt.text}
                  </button>
                );
              })}
            </div>

            {showQuizResult && (
              <div
                className="mt-3 p-2 rounded-lg text-xs flex items-center gap-1.5"
                style={{
                  backgroundColor:
                    selectedAnswers.length === currentQuizQuestion.correctAnswers.length &&
                    selectedAnswers.every(a => currentQuizQuestion.correctAnswers.includes(a))
                      ? '#ecfdf5'
                      : '#fef2f2',
                  color:
                    selectedAnswers.length === currentQuizQuestion.correctAnswers.length &&
                    selectedAnswers.every(a => currentQuizQuestion.correctAnswers.includes(a))
                      ? '#166534'
                      : '#991b1b',
                }}
              >
                {selectedAnswers.length === currentQuizQuestion.correctAnswers.length &&
                selectedAnswers.every(a => currentQuizQuestion.correctAnswers.includes(a)) ? (
                  <>
                    <CheckCircle size={14} /> 回答正确，继续下一条知识点。
                  </>
                ) : (
                  <>
                    <XCircle size={14} /> 本题已加入错题记录，稍后建议再练一次。
                  </>
                )}
              </div>
            )}

            {showQuizResult && (
              <div className="mt-3">
                {currentExplanation ? (
                  <div className="text-sm rounded-xl p-3" style={{ color: '#6b21a8', backgroundColor: '#f5f3ff' }}>
                    <div className="font-medium mb-1">题目解析</div>
                    {currentExplanation}
                  </div>
                ) : (
                  <button
                    onClick={handleGenerateExplanation}
                    disabled={generatingExplanation}
                    className="w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{ backgroundColor: '#f3e8ff', color: '#7e22ce' }}
                  >
                    {generatingExplanation ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        正在生成解析...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        查看解析（仅缺失时调用AI）
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {showQuizResult && currentExplanation && (
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => {
                    const optionsText = currentQuizQuestion.options
                      .map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${opt.text}`)
                      .join('\n');
                    const correctLabels = currentQuizQuestion.correctAnswers
                      .map(a => {
                        const idx = currentQuizQuestion.options.findIndex(o => o.id === a);
                        return String.fromCharCode(65 + idx);
                      })
                      .join('、');

                    navigate('ai-chat', {
                      questionContext: `题目：${currentQuizQuestion.stem}\n\n选项：\n${optionsText}\n\n正确答案：${correctLabels}\n\n解析：${currentExplanation}\n\n请进一步讲解。`,
                      subjectId: currentKP.subjectId,
                      ...(currentKP.id && { knowledgePointId: currentKP.id }),
                    });
                  }}
                  className="text-xs flex items-center gap-1 px-2 py-1 rounded-md hover:opacity-80"
                  style={{ color: '#2563eb' }}
                >
                  <MessageSquare size={10} />
                  继续追问AI
                </button>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              {!showQuizResult ? (
                <button
                  onClick={handleSubmitQuiz}
                  disabled={selectedAnswers.length === 0}
                  className="flex-1 rounded-lg py-2 text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: theme.primary }}
                >
                  提交答案
                </button>
              ) : (
                <button
                  onClick={handleFinishQuiz}
                  className="flex-1 rounded-lg py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: theme.primary }}
                >
                  继续学习
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {reviewType === 'new' && sessionMode === 'revisit' && activeRevisitKP && (
        <div className="px-4 pt-4">
          <div className="rounded-2xl p-4 border" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}>
            <div className="text-xs mb-2" style={{ color: '#1d4ed8' }}>间隔回顾 / 无配套题知识点</div>
            <FlashcardCard
              name={activeRevisitKP.name}
              explanation={activeRevisitKP.explanation || '暂无解析'}
              memoryTip={activeRevisitKP.memoryTip}
              isFlipped={isCardFlipped}
              onFlip={() => setIsCardFlipped(prev => !prev)}
            />
            <button
              onClick={handleFinishRevisit}
              className="mt-3 w-full rounded-lg py-2 text-sm font-medium text-white"
              style={{ backgroundColor: '#2563eb' }}
            >
              完成回顾，继续
            </button>
          </div>
        </div>
      )}

      {showNextOption && reviewType === 'review' && sessionMode === 'rate' ? (
        <div className="px-4 pt-6">
          <h3 className="text-sm font-semibold text-center mb-4" style={{ color: theme.textPrimary }}>接下来你想做什么？</h3>
          <div className="space-y-3">
            <button
              onClick={() => handleNextAction('continue')}
              className="w-full rounded-xl p-4 border shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform"
              style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${theme.primary}1a` }}>
                  <ArrowRight size={18} style={{ color: theme.primary }} />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>{isLastItem ? '完成学习' : '继续学习'}</div>
                  <div className="text-xs" style={{ color: theme.textMuted }}>{isLastItem ? `已完成 ${knowledgePoints.length} 个知识点` : '下一个知识点'}</div>
                </div>
              </div>
              <ChevronRight size={16} style={{ color: theme.textMuted }} />
            </button>

            {relatedQuestions.length > 0 && (
              <button
                onClick={() => handleNextAction('quiz')}
                className="w-full rounded-xl p-4 border shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform"
                style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${theme.success}20` }}>
                    <Sparkles size={18} style={{ color: theme.success }} />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>刷题巩固</div>
                    <div className="text-xs" style={{ color: theme.textMuted }}>练习 {relatedQuestions.length} 道相关题目</div>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: theme.textMuted }} />
              </button>
            )}

            {hasNextStage && (
              <button
                onClick={() => handleNextAction('next_stage')}
                className="w-full rounded-xl p-4 shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform text-white"
                style={{ background: `linear-gradient(to right, ${theme.primary}, ${theme.primaryLight})` }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                    <ArrowRight size={18} />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">继续{nextStageLabel}</div>
                    <div className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                      {reviewType === 'review' ? `${learningState.todayNewItems.filter(r => !r.completed).length} 个新知识点待学习` : '复习更多内容'}
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: 'rgba(255, 255, 255, 0.6)' }} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {sessionMode === 'rate' && (
            <div className="px-4 pt-6">
            <h3 className="text-sm font-semibold text-center mb-3" style={{ color: theme.textPrimary }}>你对这个知识点的掌握程度？</h3>
            <div className="grid grid-cols-4 gap-2">
              {(['none', 'rusty', 'normal', 'master'] as ProficiencyLevel[]).map(level => {
                const config = PROFICIENCY_MAP[level];
                return (
                  <button
                    key={level}
                    onClick={() => handleRate(level)}
                    className="rounded-xl p-3 text-center border-2 border-transparent transition-all active:scale-95"
                    style={{ backgroundColor: config.bgColor }}
                  >
                    <div className="text-lg mb-0.5">
                      {level === 'none' ? '😵' : level === 'rusty' ? '🤔' : level === 'normal' ? '😊' : '😎'}
                    </div>
                    <div className="text-xs font-medium" style={{ color: config.color }}>
                      {config.label}
                    </div>
                  </button>
                );
              })}
            </div>
            </div>
          )}

          {sessionMode === 'rate' && (
            <div className="px-4 pt-4 pb-8">
              <button
                onClick={() => handleRate(currentKP.proficiency)}
                className="w-full text-xs py-2.5 rounded-xl flex items-center justify-center gap-1"
                style={{ backgroundColor: theme.border, color: theme.textMuted }}
              >
                <CheckCircle size={12} />
                保持当前熟练度，跳过
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
