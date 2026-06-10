import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, ChevronRight, Loader2, Lock, Sparkles, X } from 'lucide-react';
import { useGame } from '@/store/GameContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { useUser } from '@/store/UserContext';
import type { AIStudyPlan, AIStudyPlanChapter, Question } from '@/types';
import {
  fetchAIChapterSynthesis,
  fetchAIStudyExplanation,
  fetchAIStudyPlan,
  fetchAIStudyPractice,
  saveAIStudySummary,
} from '@/services/aiStudyService';
import { getAIStudyLevelInfo, AI_STUDY_UNLOCK_LEVEL } from '@/utils/aiStudyAccess';
import { generateTodayReviewPlan } from '@/utils/review';

type Stage = 'setup' | 'plan' | 'explain' | 'practice' | 'chapter_review' | 'summary';
type PendingAnswer = {
  question: Question;
  selectedAnswers: string[];
  correct: boolean;
};

function isCorrectAnswer(question: Question, selectedAnswers: string[]) {
  return selectedAnswers.length === question.correctAnswers.length
    && selectedAnswers.every(answer => question.correctAnswers.includes(answer));
}

function nextReviewDate(days = 1) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

export default function AIStudyPage() {
  const { userState, navigate } = useUser();
  const { gameState } = useGame();
  const { learningState, learningDispatch } = useLearning();
  const { theme } = useTheme();
  const { unlocked, levelProgress } = getAIStudyLevelInfo(userState.user, learningState, gameState.checkin);
  const subjectsWithContent = useMemo(
    () => learningState.subjects.filter(subject => learningState.knowledgePoints.some(kp => kp.subjectId === subject.id && !kp.deletedAt)),
    [learningState.knowledgePoints, learningState.subjects],
  );
  const knowledgePointCountBySubject = useMemo(
    () => learningState.knowledgePoints.reduce<Record<string, number>>((counts, kp) => {
      if (!kp.deletedAt) counts[kp.subjectId] = (counts[kp.subjectId] || 0) + 1;
      return counts;
    }, {}),
    [learningState.knowledgePoints],
  );
  const initialSubjectId = userState.pageParams.subjectId || subjectsWithContent[0]?.id || '';
  const initialGoal = userState.pageParams.goal?.trim() || '';
  const shouldAutoGenerate = userState.pageParams.autoGenerate === '1' && Boolean(initialGoal);
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [stage, setStage] = useState<Stage>('setup');
  const [plan, setPlan] = useState<AIStudyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chapterIndex, setChapterIndex] = useState(0);
  const [kpIndex, setKpIndex] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [memoryTip, setMemoryTip] = useState('');
  const [practiceQuestions, setPracticeQuestions] = useState<Question[]>([]);
  const [pendingAnswers, setPendingAnswers] = useState<PendingAnswer[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [weakPointIds, setWeakPointIds] = useState<string[]>([]);
  const [, setCompletedPointIds] = useState<string[]>([]);
  const [summaryText, setSummaryText] = useState('');
  const [adviceText, setAdviceText] = useState('');
  const autoGenerateStartedRef = useRef(false);

  const selectedSubject = learningState.subjects.find(subject => subject.id === subjectId) || subjectsWithContent[0];
  const subjectChapters = useMemo(
    () => learningState.chapters
      .filter(chapter => chapter.subjectId === selectedSubject?.id)
      .sort((a, b) => a.order - b.order),
    [learningState.chapters, selectedSubject?.id],
  );
  const subjectKps = useMemo(
    () => learningState.knowledgePoints.filter(kp => kp.subjectId === selectedSubject?.id && !kp.deletedAt),
    [learningState.knowledgePoints, selectedSubject?.id],
  );
  const currentPlanChapter = plan?.chapters[chapterIndex];
  const currentPlanKp = currentPlanChapter?.knowledgePoints[kpIndex];
  const currentKp = currentPlanKp
    ? learningState.knowledgePoints.find(kp => kp.id === currentPlanKp.id)
    : undefined;
  const currentQuestion = practiceQuestions[questionIndex];
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  const buildPlan = useCallback(async () => {
    if (!selectedSubject) return;
    setLoading(true);
    setError('');
    try {
      const chapterIdsWithContent = new Set(subjectKps.map(kp => kp.chapterId));
      const defaultChapterIds = initialGoal
        ? undefined
        : subjectChapters
          .filter(chapter => chapterIdsWithContent.has(chapter.id))
          .slice(0, 3)
          .map(chapter => chapter.id);
      const result = await fetchAIStudyPlan({
        subject: selectedSubject,
        chapters: subjectChapters,
        knowledgePoints: subjectKps,
        goal: initialGoal || undefined,
        chapterIds: defaultChapterIds,
      });
      if (result.plan.chapters.length === 0) {
        setError('当前学科没有可规划的知识点。');
        return;
      }
      setPlan(result.plan);
      setStage('plan');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成规划失败');
    } finally {
      setLoading(false);
    }
  }, [initialGoal, selectedSubject, subjectChapters, subjectKps]);

  useEffect(() => {
    if (!shouldAutoGenerate || !unlocked || !selectedSubject || autoGenerateStartedRef.current) return;
    autoGenerateStartedRef.current = true;
    void buildPlan();
  }, [buildPlan, selectedSubject, shouldAutoGenerate, unlocked]);

  const removeChapter = (chapterId: string) => {
    setPlan(current => current
      ? { ...current, chapters: current.chapters.filter(chapter => chapter.id !== chapterId) }
      : current);
  };

  const removeKnowledgePoint = (chapterId: string, kpId: string) => {
    setPlan(current => {
      if (!current) return current;
      const chapters = current.chapters
        .map(chapter => chapter.id === chapterId
          ? { ...chapter, knowledgePoints: chapter.knowledgePoints.filter(kp => kp.id !== kpId) }
          : chapter)
        .filter(chapter => chapter.knowledgePoints.length > 0);
      return { ...current, chapters };
    });
  };

  const startKnowledgePointAt = useCallback(async (targetChapterIndex: number, targetKpIndex: number) => {
    if (!selectedSubject || !plan) return;
    const targetPlanKp = plan.chapters[targetChapterIndex]?.knowledgePoints[targetKpIndex];
    const targetKp = targetPlanKp
      ? learningState.knowledgePoints.find(kp => kp.id === targetPlanKp.id)
      : undefined;
    if (!targetKp || !targetPlanKp) return;
    setLoading(true);
    setError('');
    try {
      const [explainResult, practiceResult] = await Promise.all([
        fetchAIStudyExplanation({ subjectId: selectedSubject.id, knowledgePoint: targetKp, goal: targetPlanKp.goal }),
        fetchAIStudyPractice({ subjectId: selectedSubject.id, knowledgePoint: targetKp, difficulty: targetPlanKp.difficulty }),
      ]);
      setExplanation(explainResult.explanation);
      setMemoryTip(explainResult.memoryTip);
      setPracticeQuestions(practiceResult.questions.slice(0, 3));
      setPendingAnswers([]);
      setQuestionIndex(0);
      setSelectedAnswers([]);
      setShowResult(false);
      setStage('explain');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成讲解失败');
    } finally {
      setLoading(false);
    }
  }, [learningState.knowledgePoints, plan, selectedSubject]);

  const startSession = () => {
    if (!plan || plan.chapters.length === 0) return;
    setChapterIndex(0);
    setKpIndex(0);
    setCorrectCount(0);
    setTotalQuestions(0);
    setWeakPointIds([]);
    setCompletedPointIds([]);
    void startKnowledgePointAt(0, 0);
  };

  const submitAnswer = () => {
    if (!currentQuestion || !currentKp || selectedAnswers.length === 0) return;
    const correct = isCorrectAnswer(currentQuestion, selectedAnswers);
    setShowResult(true);
    setPendingAnswers(items => [
      ...items.filter(item => item.question.id !== currentQuestion.id),
      { question: currentQuestion, selectedAnswers: [...selectedAnswers], correct },
    ]);
    setTotalQuestions(value => value + 1);
    if (correct) setCorrectCount(value => value + 1);
    else setWeakPointIds(ids => Array.from(new Set([...ids, currentKp.id])));
  };

  const finishKnowledgePoint = () => {
    if (!currentKp) return;
    const now = new Date().toISOString();
    practiceQuestions.forEach(question => {
      learningDispatch({ type: 'AI_ADD_GENERATED_QUESTION', payload: question });
      learningDispatch({
        type: 'SAVE_QUESTION_EXPLANATION',
        payload: {
          questionId: question.id,
          explanation: question.explanation,
          createdAt: now,
          updatedAt: now,
          isUserModified: false,
        },
      });
    });
    pendingAnswers.forEach(answer => {
      learningDispatch({
        type: 'RECORD_QUIZ_ANSWER',
        payload: {
          knowledgePointId: currentKp.id,
          questionId: answer.question.id,
          correct: answer.correct,
          score: answer.correct ? 100 : 40,
        },
      });
      if (!answer.correct) {
        learningDispatch({
          type: 'ADD_WRONG_RECORD',
          payload: {
            id: `wr-ai-${Date.now()}-${answer.question.id}`,
            questionId: answer.question.id,
            wrongAnswers: answer.selectedAnswers,
            correctAnswers: answer.question.correctAnswers,
            addedAt: now,
            reviewedCount: 0,
            lastReviewedAt: null,
          },
        });
      }
    });
    learningDispatch({
      type: 'UPDATE_KNOWLEDGE_POINT',
      payload: { id: currentKp.id, explanation },
    });
    learningDispatch({
      type: 'SET_MEMORY_TIP',
      payload: { knowledgePointId: currentKp.id, tip: memoryTip },
    });
    const cardUpdates = {
      proficiency: weakPointIds.includes(currentKp.id) ? 'rusty' as const : 'normal' as const,
      lastReviewedAt: now,
      nextReviewAt: nextReviewDate(1),
      reviewCount: (currentKp.reviewCount ?? 0) + 1,
      currentScore: weakPointIds.includes(currentKp.id) ? 60 : 85,
      fsrsState: 'Review' as const,
      fsrsReps: (currentKp.fsrsReps ?? 0) + 1,
    };
    learningDispatch({
      type: 'UPDATE_FSRS_CARD',
      payload: {
        knowledgePointId: currentKp.id,
        updates: cardUpdates,
      },
    });
    learningDispatch({ type: 'COMPLETE_REVIEW_ITEM', payload: currentKp.id });
    const updatedKnowledgePoints = learningState.knowledgePoints.map(kp => (
      kp.id === currentKp.id
        ? { ...kp, ...cardUpdates, explanation, memoryTip }
        : kp
    ));
    const { review, newItems } = generateTodayReviewPlan(updatedKnowledgePoints, learningState.todayNewItems);
    learningDispatch({ type: 'SET_REVIEW_ITEMS', payload: { review, newItems } });
    setCompletedPointIds(ids => Array.from(new Set([...ids, currentKp.id])));
  };

  const goNext = async () => {
    if (!plan) return;
    if (questionIndex < practiceQuestions.length - 1) {
      setQuestionIndex(index => index + 1);
      setSelectedAnswers([]);
      setShowResult(false);
      return;
    }
    finishKnowledgePoint();
    const chapter = plan.chapters[chapterIndex];
    if (kpIndex < chapter.knowledgePoints.length - 1) {
      const nextKpIndex = kpIndex + 1;
      setKpIndex(nextKpIndex);
      setStage('explain');
      void startKnowledgePointAt(chapterIndex, nextKpIndex);
      return;
    }
    await startChapterReview(chapter);
  };

  const startChapterReview = async (chapter: AIStudyPlanChapter) => {
    if (!selectedSubject) return;
    setLoading(true);
    try {
      const realChapter = learningState.chapters.find(item => item.id === chapter.id);
      if (!realChapter) return;
      const result = await fetchAIChapterSynthesis({
        subjectId: selectedSubject.id,
        chapter: realChapter,
        knowledgePoints: subjectKps.filter(kp => chapter.knowledgePoints.some(item => item.id === kp.id)),
      });
      setPracticeQuestions(result.questions);
      setPendingAnswers([]);
      setQuestionIndex(0);
      setSelectedAnswers([]);
      setShowResult(false);
      setStage('chapter_review');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成综合题失败');
    } finally {
      setLoading(false);
    }
  };

  const finishChapterReview = async () => {
    if (!plan) return;
    if (questionIndex < practiceQuestions.length - 1) {
      setQuestionIndex(index => index + 1);
      setSelectedAnswers([]);
      setShowResult(false);
      return;
    }
    const now = new Date().toISOString();
    practiceQuestions.forEach(question => {
      learningDispatch({ type: 'AI_ADD_GENERATED_QUESTION', payload: question });
      learningDispatch({
        type: 'SAVE_QUESTION_EXPLANATION',
        payload: {
          questionId: question.id,
          explanation: question.explanation,
          createdAt: now,
          updatedAt: now,
          isUserModified: false,
        },
      });
    });
    if (currentKp) {
      pendingAnswers.forEach(answer => {
        learningDispatch({
          type: 'RECORD_QUIZ_ANSWER',
          payload: {
            knowledgePointId: currentKp.id,
            questionId: answer.question.id,
            correct: answer.correct,
            score: answer.correct ? 100 : 40,
          },
        });
      });
    }
    if (chapterIndex < plan.chapters.length - 1) {
      const nextChapterIndex = chapterIndex + 1;
      setChapterIndex(nextChapterIndex);
      setKpIndex(0);
      void startKnowledgePointAt(nextChapterIndex, 0);
      return;
    }
    await finishSession();
  };

  const finishSession = async () => {
    if (!plan) return;
    setLoading(true);
    const chapterNames = plan.chapters.map(chapter => chapter.name);
    const kpIds = plan.chapters.flatMap(chapter => chapter.knowledgePoints.map(kp => kp.id));
    const kpNames = plan.chapters.flatMap(chapter => chapter.knowledgePoints.map(kp => kp.name));
    const weakNames = weakPointIds
      .map(id => learningState.knowledgePoints.find(kp => kp.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    const summary = `本次完成 ${kpNames.length} 个知识点，练习正确率 ${accuracy}%。${weakNames.length > 0 ? `薄弱点集中在：${weakNames.join('、')}。` : '整体掌握稳定。'}`;
    const advice = weakNames.length > 0
      ? '下次先从薄弱点复习开始，再继续规划后续 3 章。'
      : '下次可以继续规划后续 3 章，同时按复习模块回顾今天生成的知识卡片。';
    try {
      const saved = await saveAIStudySummary({
        sessionId: `ai-session-${plan.id}`,
        subjectId: plan.subjectId,
        subjectName: plan.subjectName,
        chapterIds: plan.chapters.map(chapter => chapter.id),
        chapterNames,
        knowledgePointIds: kpIds,
        knowledgePointNames: kpNames,
        correctCount,
        totalQuestions,
        weakPoints: weakNames,
        summary,
        advice,
      });
      setSummaryText(saved.summary.summary);
      setAdviceText(saved.summary.advice);
      const { review, newItems } = generateTodayReviewPlan(learningState.knowledgePoints, learningState.todayNewItems);
      learningDispatch({ type: 'SET_REVIEW_ITEMS', payload: { review, newItems } });
      setStage('summary');
    } catch (err) {
      setSummaryText(summary);
      setAdviceText(advice);
      setError(err instanceof Error ? err.message : '总结已生成，但云端保存失败');
      setStage('summary');
    } finally {
      setLoading(false);
    }
  };

  const answerControl = currentQuestion ? (
    <div className="space-y-3">
      <div className="rounded-2xl border p-4" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
        <div className="mb-2 text-xs font-semibold" style={{ color: theme.textMuted }}>
          {stage === 'chapter_review' ? '章内综合题' : `练习 ${questionIndex + 1} / ${practiceQuestions.length}`}
        </div>
        <p className="text-base font-bold leading-7" style={{ color: theme.textPrimary }}>{currentQuestion.stem}</p>
      </div>
      {currentQuestion.options.map((item, index) => {
        const selected = selectedAnswers.includes(item.id);
        const correctOption = currentQuestion.correctAnswers.includes(item.id);
        const bg = showResult && correctOption ? '#ecfdf5' : showResult && selected ? '#fef2f2' : selected ? `${theme.primary}12` : theme.bgCard;
        const border = showResult && correctOption ? '#86efac' : showResult && selected ? '#fca5a5' : selected ? theme.primary : theme.border;
        return (
          <button
            key={item.id}
            onClick={() => !showResult && setSelectedAnswers([item.id])}
            className="flex w-full items-start gap-3 rounded-2xl border p-4 text-left"
            style={{ backgroundColor: bg, borderColor: border, color: theme.textPrimary }}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: `${theme.primary}18`, color: theme.primary }}>
              {String.fromCharCode(65 + index)}
            </span>
            <span className="text-sm leading-6">{item.text}</span>
          </button>
        );
      })}
      {showResult && (
        <div className="rounded-2xl border p-4 text-sm leading-6" style={{ backgroundColor: '#f5f3ff', borderColor: '#ddd6fe', color: '#5b21b6' }}>
          {currentQuestion.explanation}
        </div>
      )}
      <button
        onClick={showResult ? (stage === 'chapter_review' ? finishChapterReview : goNext) : submitAnswer}
        disabled={!showResult && selectedAnswers.length === 0}
        className="w-full rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-50"
        style={{ backgroundColor: theme.primary }}
      >
        {showResult ? '继续' : '提交答案'}
      </button>
    </div>
  ) : null;

  if (!unlocked) {
    return (
      <div className="page-scroll min-h-screen px-4 py-5" style={{ backgroundColor: theme.bg }}>
        <button onClick={() => navigate('ai-chat')} className="mb-5 flex items-center gap-2 text-sm font-semibold" style={{ color: theme.textSecondary }}>
          <ArrowLeft size={18} /> 返回 AI 问答
        </button>
        <div className="rounded-3xl border p-6 text-center" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${theme.primary}16`, color: theme.primary }}>
            <Lock size={28} />
          </div>
          <h1 className="text-xl font-extrabold" style={{ color: theme.textPrimary }}>AI 辅助学习 Lv.{AI_STUDY_UNLOCK_LEVEL} 解锁</h1>
          <p className="mt-3 text-sm leading-6" style={{ color: theme.textSecondary }}>
            当前 Lv.{levelProgress.level}，普通 AI 问答仍可使用。解锁后可以在 AI 问答页切换到学习模式，使用 AI 自动规划、讲解、练习和总结。
          </p>
          <div className="mt-5 h-2 overflow-hidden rounded-full" style={{ backgroundColor: theme.border }}>
            <div className="h-full rounded-full" style={{ width: `${levelProgress.progressPercent}%`, backgroundColor: theme.primary }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-scroll min-h-screen px-4 py-5" style={{ backgroundColor: theme.bg }}>
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => navigate('ai-chat')} className="flex items-center gap-2 text-sm font-semibold" style={{ color: theme.textSecondary }}>
          <ArrowLeft size={18} /> 返回 AI 问答
        </button>
        <button onClick={() => navigate('ai-study-summaries')} className="rounded-xl px-3 py-2 text-xs font-bold" style={{ backgroundColor: `${theme.primary}12`, color: theme.primary }}>
          学习总结
        </button>
      </div>

      <header className="mb-4 rounded-3xl border p-5" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: theme.primary }}>
            <Sparkles size={22} />
          </span>
          <div>
            <h1 className="text-xl font-extrabold" style={{ color: theme.textPrimary }}>AI 辅助学习</h1>
            <p className="mt-1 text-xs" style={{ color: theme.textSecondary }}>
              {initialGoal ? `学习目标：${initialGoal}` : '规划 3 章，讲解后练 3 题，再进入复习。'}
            </p>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      {stage === 'setup' && (
        <section className="rounded-3xl border p-5" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
          <h2 className="mb-3 text-base font-bold" style={{ color: theme.textPrimary }}>选择学习学科</h2>
          <div className="space-y-2">
            {subjectsWithContent.map(subject => (
              <button
                key={subject.id}
                onClick={() => setSubjectId(subject.id)}
                className="flex w-full items-center justify-between rounded-2xl border p-4 text-left"
                style={{
                  borderColor: subjectId === subject.id ? theme.primary : theme.border,
                  backgroundColor: subjectId === subject.id ? `${theme.primary}10` : theme.bg,
                }}
              >
                <span className="font-semibold" style={{ color: theme.textPrimary }}>{subject.icon} {subject.name}</span>
                <span className="text-xs" style={{ color: theme.textMuted }}>{knowledgePointCountBySubject[subject.id] || 0} 知识点</span>
              </button>
            ))}
          </div>
          <button
            onClick={buildPlan}
            disabled={loading || !selectedSubject}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: theme.primary }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
            生成 3 章学习规划
          </button>
        </section>
      )}

      {stage === 'plan' && plan && (
        <section className="rounded-3xl border p-5" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold" style={{ color: theme.textPrimary }}>确认学习规划</h2>
              <p className="mt-1 text-xs" style={{ color: theme.textSecondary }}>可以先删掉不想学的章节或知识点。</p>
            </div>
            <button onClick={() => setStage('setup')} className="rounded-full p-2" style={{ backgroundColor: theme.bg }}>
              <X size={16} />
            </button>
          </div>
          <div className="space-y-3">
            {plan.chapters.map(chapter => (
              <div key={chapter.id} className="rounded-2xl border p-4" style={{ borderColor: theme.border, backgroundColor: theme.bg }}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold" style={{ color: theme.textPrimary }}>{chapter.name}</h3>
                    <p className="mt-1 text-xs leading-5" style={{ color: theme.textSecondary }}>{chapter.goal}</p>
                  </div>
                  <button onClick={() => removeChapter(chapter.id)} className="shrink-0 text-xs font-bold text-red-500">移除</button>
                </div>
                <div className="space-y-2">
                  {chapter.knowledgePoints.map(kp => (
                    <div key={kp.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: theme.bgCard }}>
                      <span className="text-sm" style={{ color: theme.textPrimary }}>{kp.name}</span>
                      <button onClick={() => removeKnowledgePoint(chapter.id, kp.id)} className="text-xs" style={{ color: theme.textMuted }}>删除</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={startSession}
            disabled={loading || plan.chapters.length === 0}
            className="mt-4 w-full rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: theme.primary }}
          >
            确认并开始学习
          </button>
        </section>
      )}

      {stage === 'explain' && currentKp && (
        <section className="space-y-4">
          <div className="rounded-3xl border p-5" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
            <div className="mb-2 text-xs font-semibold" style={{ color: theme.textMuted }}>{currentPlanChapter?.name}</div>
            <h2 className="text-xl font-extrabold" style={{ color: theme.textPrimary }}>{currentKp.name}</h2>
            <div className="mt-4 whitespace-pre-line text-sm leading-7" style={{ color: theme.textSecondary }}>{explanation}</div>
          </div>
          <button onClick={() => setStage('practice')} className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white" style={{ backgroundColor: theme.primary }}>
            开始 3 题练习 <ChevronRight size={16} />
          </button>
        </section>
      )}

      {(stage === 'practice' || stage === 'chapter_review') && answerControl}

      {stage === 'summary' && (
        <section className="rounded-3xl border p-5" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-green-600">
            <CheckCircle2 size={26} />
          </div>
          <h2 className="text-xl font-extrabold" style={{ color: theme.textPrimary }}>本轮学习完成</h2>
          <p className="mt-3 text-sm leading-7" style={{ color: theme.textSecondary }}>{summaryText}</p>
          <div className="mt-4 rounded-2xl border p-4 text-sm leading-7" style={{ borderColor: theme.border, backgroundColor: theme.bg }}>
            {adviceText}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button onClick={() => navigate('ai-study-summaries')} className="rounded-2xl py-3 text-sm font-bold" style={{ backgroundColor: theme.bg, color: theme.textPrimary }}>
              查看总结
            </button>
            <button onClick={() => setStage('setup')} className="rounded-2xl py-3 text-sm font-bold text-white" style={{ backgroundColor: theme.primary }}>
              继续规划
            </button>
          </div>
        </section>
      )}

      {loading && stage !== 'setup' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-700 shadow-xl">
            <Loader2 className="mr-2 inline animate-spin" size={16} /> 正在生成
          </div>
        </div>
      )}
    </div>
  );
}
