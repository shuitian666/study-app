import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, ChevronRight, Lightbulb, Loader2, Lock, MessageCircle, Target, X } from 'lucide-react';
import StudyTutorPanel from '@/components/ai/StudyTutorPanel';
import { useGame } from '@/store/GameContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { useUser } from '@/store/UserContext';
import type {
  AIStudyPlan,
  AIStudyPlanChapter,
  AIStudyPlanKnowledgePoint,
  AIStudyExplanation,
  AIStudyTutorContext,
  Chapter,
  KnowledgePointExtended,
  Question,
  QuestionExplanation,
  Subject,
  WrongRecord,
} from '@/types';
import {
  fetchAIChapterSynthesis,
  fetchAIStudyExplanation,
  fetchAIStudyPlan,
  fetchAIStudyPractice,
  saveAIStudySummary,
} from '@/services/aiStudyService';
import { getAIStudyLevelInfo, AI_STUDY_UNLOCK_LEVEL } from '@/utils/aiStudyAccess';
import { generateTodayReviewPlan } from '@/utils/review';
import StudyRichText from '@/components/ai/StudyRichText';

type Stage = 'setup' | 'plan' | 'explain' | 'practice' | 'chapter_review' | 'summary';

type PendingAnswer = {
  question: Question;
  selectedAnswers: string[];
  correct: boolean;
};

type PreparedStudyContent = {
  explanation: AIStudyExplanation;
  questions: Question[];
};

interface AIStudyPageProps {
  onOpenTutor?: (context: AIStudyTutorContext) => void;
}

const SECTION_TUTOR_PROMPTS = ['换个说法', '再举个例子', '这里没看懂'] as const;

function isCorrectAnswer(question: Question, selectedAnswers: string[]) {
  return selectedAnswers.length === question.correctAnswers.length
    && selectedAnswers.every(answer => question.correctAnswers.includes(answer));
}

function nextReviewDate(days = 1) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function normalizeName(value: string) {
  return value.toLocaleLowerCase('zh-CN').replace(/[\s·•,，。:：;；()（）[\]【】_-]+/g, '');
}

function findSubject(plan: AIStudyPlan, subjects: Subject[]) {
  return subjects.find(subject => subject.id === plan.subjectId)
    || subjects.find(subject => normalizeName(subject.name) === normalizeName(plan.subjectName));
}

function findChapter(planChapter: AIStudyPlanChapter, subjectId: string, chapters: Chapter[]) {
  return chapters.find(chapter => chapter.id === planChapter.id)
    || chapters.find(chapter =>
      chapter.subjectId === subjectId
      && normalizeName(chapter.name) === normalizeName(planChapter.name)
    );
}

function findKnowledgePoint(
  planPoint: AIStudyPlanKnowledgePoint,
  chapterId: string,
  knowledgePoints: KnowledgePointExtended[],
) {
  return knowledgePoints.find(kp => kp.id === planPoint.id)
    || knowledgePoints.find(kp =>
      kp.chapterId === chapterId
      && normalizeName(kp.name) === normalizeName(planPoint.name)
  );
}

function getNextKnowledgePointPosition(
  plan: AIStudyPlan,
  chapterIndex: number,
  knowledgePointIndex: number,
) {
  const currentChapter = plan.chapters[chapterIndex];
  if (currentChapter && knowledgePointIndex + 1 < currentChapter.knowledgePoints.length) {
    return { chapterIndex, knowledgePointIndex: knowledgePointIndex + 1 };
  }
  for (let nextChapterIndex = chapterIndex + 1; nextChapterIndex < plan.chapters.length; nextChapterIndex += 1) {
    if (plan.chapters[nextChapterIndex]?.knowledgePoints.length) {
      return { chapterIndex: nextChapterIndex, knowledgePointIndex: 0 };
    }
  }
  return null;
}

export default function AIStudyPage({ onOpenTutor }: AIStudyPageProps) {
  const { userState, navigate } = useUser();
  const { gameState } = useGame();
  const { learningState, learningDispatch } = useLearning();
  const { theme } = useTheme();
  const { unlocked, levelProgress } = getAIStudyLevelInfo(userState.user, learningState, gameState.checkin);
  const initialGoal = userState.pageParams.goal?.trim() || '';
  const initialScopeSubjectId = userState.pageParams.scopeSubjectId || '';
  const shouldAutoGenerate = userState.pageParams.autoGenerate === '1' && Boolean(initialGoal);

  const [goal, setGoal] = useState(initialGoal);
  const [scopeSubjectId, setScopeSubjectId] = useState(initialScopeSubjectId);
  const [stage, setStage] = useState<Stage>('setup');
  const [plan, setPlan] = useState<AIStudyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chapterIndex, setChapterIndex] = useState(0);
  const [kpIndex, setKpIndex] = useState(0);
  const [studyExplanation, setStudyExplanation] = useState<AIStudyExplanation | null>(null);
  const [practiceQuestions, setPracticeQuestions] = useState<Question[]>([]);
  const [pendingAnswers, setPendingAnswers] = useState<PendingAnswer[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [weakPointIds, setWeakPointIds] = useState<string[]>([]);
  const [summaryText, setSummaryText] = useState('');
  const [adviceText, setAdviceText] = useState('');
  const [mobileTutorContext, setMobileTutorContext] = useState<AIStudyTutorContext | null>(null);
  const autoGenerateStartedRef = useRef(false);
  const resolvedPointIdsRef = useRef(new Map<string, string>());
  const resolvedChapterIdsRef = useRef(new Map<string, string>());
  const preparedContentRef = useRef(new Map<string, Promise<PreparedStudyContent>>());
  const activeContentRequestRef = useRef(0);

  const subjectsWithContent = useMemo(
    () => learningState.subjects.filter(subject =>
      learningState.knowledgePoints.some(kp => kp.subjectId === subject.id && !kp.deletedAt)
    ),
    [learningState.knowledgePoints, learningState.subjects],
  );
  const currentPlanChapter = plan?.chapters[chapterIndex];
  const currentPlanKp = currentPlanChapter?.knowledgePoints[kpIndex];
  const currentQuestion = practiceQuestions[questionIndex];
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const explanationText = useMemo(() => {
    if (!studyExplanation) return '';
    return [
      studyExplanation.overview,
      ...studyExplanation.sections.map(section => `${section.title}\n${section.content}`),
    ].join('\n\n').replace(/\*\*/g, '');
  }, [studyExplanation]);

  const buildPlan = useCallback(async () => {
    const trimmedGoal = goal.trim();
    if (!trimmedGoal) {
      setError('请先描述这次想学习的内容。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await fetchAIStudyPlan({
        goal: trimmedGoal,
        scopeSubjectId: scopeSubjectId || undefined,
        subjects: learningState.subjects,
        chapters: learningState.chapters,
        knowledgePoints: learningState.knowledgePoints.filter(kp => !kp.deletedAt),
      });
      setPlan(result.plan);
      setStage('plan');
      resolvedPointIdsRef.current.clear();
      resolvedChapterIdsRef.current.clear();
      preparedContentRef.current.clear();
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成规划失败，请重试。');
      setStage('setup');
    } finally {
      setLoading(false);
    }
  }, [goal, learningState.chapters, learningState.knowledgePoints, learningState.subjects, scopeSubjectId]);

  useEffect(() => {
    if (!shouldAutoGenerate || !unlocked || autoGenerateStartedRef.current) return;
    autoGenerateStartedRef.current = true;
    void buildPlan();
  }, [buildPlan, shouldAutoGenerate, unlocked]);

  useEffect(() => () => {
    activeContentRequestRef.current += 1;
    preparedContentRef.current.clear();
  }, []);

  const removeChapter = (chapterId: string) => {
    setPlan(current => current
      ? { ...current, chapters: current.chapters.filter(chapter => chapter.id !== chapterId) }
      : current);
  };

  const removeKnowledgePoint = (chapterId: string, kpId: string) => {
    setPlan(current => {
      if (!current) return current;
      return {
        ...current,
        chapters: current.chapters
          .map(chapter => chapter.id === chapterId
            ? { ...chapter, knowledgePoints: chapter.knowledgePoints.filter(kp => kp.id !== kpId) }
            : chapter)
          .filter(chapter => chapter.knowledgePoints.length > 0),
      };
    });
  };

  const studyPointFor = useCallback((planPoint: AIStudyPlanKnowledgePoint) => (
    learningState.knowledgePoints.find(kp => kp.id === planPoint.id)
    || {
      ...planPoint,
      explanation: planPoint.baseExplanation,
    }
  ), [learningState.knowledgePoints]);

  const prepareKnowledgePointAt = useCallback((
    targetChapterIndex: number,
    targetKpIndex: number,
  ): Promise<PreparedStudyContent> => {
    if (!plan) return Promise.reject(new Error('学习计划不存在，请重新生成。'));
    const targetPlanKp = plan.chapters[targetChapterIndex]?.knowledgePoints[targetKpIndex];
    if (!targetPlanKp) return Promise.reject(new Error('知识点不存在，请重新生成计划。'));
    const cacheKey = `${plan.id}:${targetPlanKp.id}`;
    const cached = preparedContentRef.current.get(cacheKey);
    if (cached) return cached;

    const targetKp = studyPointFor(targetPlanKp);
    const request = Promise.all([
      fetchAIStudyExplanation({
        subjectId: plan.subjectId,
        knowledgePoint: targetKp,
        goal: targetPlanKp.goal,
        difficulty: targetPlanKp.difficulty,
      }),
      fetchAIStudyPractice({
        subjectId: plan.subjectId,
        knowledgePoint: targetKp,
        difficulty: targetPlanKp.difficulty,
      }),
    ]).then(([explanation, practice]) => ({
      explanation,
      questions: practice.questions,
    }));

    preparedContentRef.current.set(cacheKey, request);
    void request.catch(() => {
      if (preparedContentRef.current.get(cacheKey) === request) {
        preparedContentRef.current.delete(cacheKey);
      }
    });
    return request;
  }, [plan, studyPointFor]);

  const preloadNextKnowledgePoint = useCallback((targetChapterIndex: number, targetKpIndex: number) => {
    if (!plan) return;
    const next = getNextKnowledgePointPosition(plan, targetChapterIndex, targetKpIndex);
    if (!next) return;
    void prepareKnowledgePointAt(next.chapterIndex, next.knowledgePointIndex).catch(() => {
      // Background preparation is best-effort; foreground navigation retries automatically.
    });
  }, [plan, prepareKnowledgePointAt]);

  const startKnowledgePointAt = useCallback(async (targetChapterIndex: number, targetKpIndex: number) => {
    if (!plan) return;
    const targetPlanKp = plan.chapters[targetChapterIndex]?.knowledgePoints[targetKpIndex];
    if (!targetPlanKp) return;
    const requestId = activeContentRequestRef.current + 1;
    activeContentRequestRef.current = requestId;
    setLoading(true);
    setError('');
    try {
      const prepared = await prepareKnowledgePointAt(targetChapterIndex, targetKpIndex);
      if (activeContentRequestRef.current !== requestId) return;
      setStudyExplanation(prepared.explanation);
      setPracticeQuestions(prepared.questions);
      setPendingAnswers([]);
      setQuestionIndex(0);
      setSelectedAnswers([]);
      setShowResult(false);
      setStage('explain');
      preloadNextKnowledgePoint(targetChapterIndex, targetKpIndex);
    } catch (err) {
      if (activeContentRequestRef.current !== requestId) return;
      setError(err instanceof Error ? err.message : '生成讲解失败，请重试。');
    } finally {
      if (activeContentRequestRef.current === requestId) setLoading(false);
    }
  }, [plan, preloadNextKnowledgePoint, prepareKnowledgePointAt]);

  const openTutor = useCallback((context: AIStudyTutorContext) => {
    if (onOpenTutor) {
      onOpenTutor(context);
      return;
    }
    setMobileTutorContext(context);
  }, [onOpenTutor]);

  const makeTutorContext = useCallback((
    mode: AIStudyTutorContext['mode'],
    additions: Partial<AIStudyTutorContext> = {},
  ): AIStudyTutorContext | null => {
    if (!plan || !currentPlanChapter || !currentPlanKp) return null;
    return {
      threadId: `${plan.id}:${currentPlanKp.id}`,
      mode,
      goal: goal || plan.goal || '',
      chapterName: currentPlanChapter.name,
      knowledgePointId: currentPlanKp.id,
      knowledgePointName: currentPlanKp.name,
      ...additions,
    };
  }, [currentPlanChapter, currentPlanKp, goal, plan]);

  const askAboutSection = (sectionTitle: string, sectionContent: string, prompt: string) => {
    const context = makeTutorContext('explain', {
      requestId: `section-${Date.now()}-${prompt}`,
      initialPrompt: prompt,
      sectionTitle,
      sectionContent,
    });
    if (context) openTutor(context);
  };

  const askAboutQuestion = (review: boolean) => {
    if (!currentQuestion) return;
    const context = makeTutorContext(review ? 'question_review' : 'question_hint', {
      requestId: `question-${currentQuestion.id}-${review ? 'review' : 'hint'}-${Date.now()}`,
      initialPrompt: review
        ? '请结合我的答案深入讲解这道题。'
        : '请给我一个解题方向，但不要透露答案。',
      question: {
        id: currentQuestion.id,
        stem: currentQuestion.stem,
        options: currentQuestion.options,
        ...(review ? {
          selectedAnswers,
          correctAnswers: currentQuestion.correctAnswers,
          explanation: currentQuestion.explanation,
        } : {}),
      },
    });
    if (context) openTutor(context);
  };

  const startSession = () => {
    if (!plan || plan.chapters.length === 0) return;
    preparedContentRef.current.clear();
    setChapterIndex(0);
    setKpIndex(0);
    setCorrectCount(0);
    setTotalQuestions(0);
    setWeakPointIds([]);
    void startKnowledgePointAt(0, 0);
  };

  const submitAnswer = () => {
    if (!currentQuestion || !currentPlanKp || selectedAnswers.length === 0) return;
    const correct = isCorrectAnswer(currentQuestion, selectedAnswers);
    setShowResult(true);
    setPendingAnswers(items => [
      ...items.filter(item => item.question.id !== currentQuestion.id),
      { question: currentQuestion, selectedAnswers: [...selectedAnswers], correct },
    ]);
    setTotalQuestions(value => value + 1);
    if (correct) setCorrectCount(value => value + 1);
    else setWeakPointIds(ids => Array.from(new Set([...ids, currentPlanKp.id])));
  };

  const finishKnowledgePoint = () => {
    if (!plan || !currentPlanChapter || !currentPlanKp) return;
    const now = new Date().toISOString();
    const existingSubject = findSubject(plan, learningState.subjects);
    const subjectId = existingSubject?.id || plan.subjectId;
    const subject: Subject = existingSubject || {
      id: subjectId,
      name: plan.subjectName,
      icon: plan.subjectIcon,
      color: plan.subjectColor,
      knowledgePointCount: 0,
    };
    const existingChapter = findChapter(currentPlanChapter, subjectId, learningState.chapters);
    const chapterId = existingChapter?.id || currentPlanChapter.id;
    const chapter: Chapter = existingChapter || {
      id: chapterId,
      subjectId,
      name: currentPlanChapter.name,
      order: currentPlanChapter.order,
    };
    const existingKp = findKnowledgePoint(currentPlanKp, chapterId, learningState.knowledgePoints);
    const knowledgePointId = existingKp?.id || currentPlanKp.id;
    resolvedPointIdsRef.current.set(currentPlanKp.id, knowledgePointId);
    resolvedChapterIdsRef.current.set(currentPlanChapter.id, chapterId);

    const weak = weakPointIds.includes(currentPlanKp.id);
    const remappedQuestions = practiceQuestions.map((question, index) => ({
      ...question,
      id: `ai-practice-${knowledgePointId}-${index + 1}`,
      subjectId,
      chapterId,
      knowledgePointId,
    }));
    const answerByOriginalId = new Map(pendingAnswers.map(answer => [answer.question.id, answer]));
    const quizRecords = remappedQuestions.map((question, index) => {
      const answer = answerByOriginalId.get(practiceQuestions[index]?.id);
      return {
        date: now,
        questionId: question.id,
        correct: Boolean(answer?.correct),
        score: answer?.correct ? 100 : 40,
        knowledgePointId,
      };
    });
    const knowledgePoint: KnowledgePointExtended = {
      ...(existingKp || {
        id: knowledgePointId,
        subjectId,
        chapterId,
        name: currentPlanKp.name,
        createdAt: now,
        source: 'ai' as const,
        studyRecords: [],
        quizRecords: [],
        currentScore: 0,
        proficiency: 'none' as const,
        lastReviewedAt: null,
        nextReviewAt: null,
        reviewCount: 0,
      }),
      id: knowledgePointId,
      subjectId,
      chapterId,
      name: currentPlanKp.name,
      explanation: explanationText,
      memoryTip: studyExplanation?.memoryTip.replace(/\*\*/g, '') || '',
      source: existingKp?.source || 'ai',
      proficiency: weak ? 'rusty' : 'normal',
      lastReviewedAt: now,
      nextReviewAt: nextReviewDate(1),
      reviewCount: (existingKp?.reviewCount ?? 0) + 1,
      studyRecords: [
        ...(existingKp?.studyRecords || []),
        { date: now, type: 'flashcard', score: weak ? 60 : 85, knowledgePointId },
      ],
      quizRecords: [...(existingKp?.quizRecords || []), ...quizRecords],
      currentScore: weak ? 60 : 85,
      fsrsState: 'Review',
      fsrsReps: (existingKp?.fsrsReps ?? 0) + 1,
      fsrsLearningSteps: existingKp?.fsrsLearningSteps ?? 0,
      fsrsLapses: (existingKp?.fsrsLapses ?? 0) + (weak ? 1 : 0),
    };
    const questionExplanations: QuestionExplanation[] = remappedQuestions.map(question => ({
      questionId: question.id,
      explanation: question.explanation,
      createdAt: now,
      updatedAt: now,
      isUserModified: false,
    }));
    const wrongRecords: WrongRecord[] = remappedQuestions.flatMap((question, index) => {
      const answer = answerByOriginalId.get(practiceQuestions[index]?.id);
      if (!answer || answer.correct) return [];
      return [{
        id: `wr-${question.id}`,
        questionId: question.id,
        wrongAnswers: answer.selectedAnswers,
        correctAnswers: question.correctAnswers,
        addedAt: now,
        reviewedCount: 0,
        lastReviewedAt: null,
      }];
    });

    learningDispatch({
      type: 'COMMIT_AI_STUDY_RESULT',
      payload: {
        subject,
        chapter,
        knowledgePoint,
        questions: remappedQuestions,
        questionExplanations,
        wrongRecords,
      },
    });
    const updatedKnowledgePoints = learningState.knowledgePoints.some(kp => kp.id === knowledgePointId)
      ? learningState.knowledgePoints.map(kp => kp.id === knowledgePointId ? knowledgePoint : kp)
      : [...learningState.knowledgePoints, knowledgePoint];
    const { review, newItems } = generateTodayReviewPlan(updatedKnowledgePoints, learningState.todayNewItems);
    learningDispatch({ type: 'SET_REVIEW_ITEMS', payload: { review, newItems } });
  };

  const startChapterReview = async (chapter: AIStudyPlanChapter) => {
    if (!plan) return;
    setLoading(true);
    setError('');
    try {
      const result = await fetchAIChapterSynthesis({
        subjectId: plan.subjectId,
        chapter,
        knowledgePoints: chapter.knowledgePoints.map(studyPointFor),
      });
      setPracticeQuestions(result.questions);
      setPendingAnswers([]);
      setQuestionIndex(0);
      setSelectedAnswers([]);
      setShowResult(false);
      setStage('chapter_review');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成章节综合题失败，请重试。');
    } finally {
      setLoading(false);
    }
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
      void startKnowledgePointAt(chapterIndex, nextKpIndex);
      return;
    }
    await startChapterReview(chapter);
  };

  const finishSession = async () => {
    if (!plan) return;
    setLoading(true);
    const chapterNames = plan.chapters.map(chapter => chapter.name);
    const kpNames = plan.chapters.flatMap(chapter => chapter.knowledgePoints.map(kp => kp.name));
    const kpIds = plan.chapters.flatMap(chapter =>
      chapter.knowledgePoints.map(kp => resolvedPointIdsRef.current.get(kp.id) || kp.id)
    );
    const chapterIds = plan.chapters.map(chapter => resolvedChapterIdsRef.current.get(chapter.id) || chapter.id);
    const weakNames = weakPointIds
      .map(id => plan.chapters.flatMap(chapter => chapter.knowledgePoints).find(kp => kp.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    const summary = `本次完成 ${kpNames.length} 个知识点，练习正确率 ${accuracy}%。${weakNames.length > 0 ? `薄弱点集中在：${weakNames.join('、')}。` : '整体掌握稳定。'}`;
    const advice = weakNames.length > 0
      ? '下次先从薄弱点复习开始，再继续规划后续章节。'
      : '下次可以沿用当前目标继续规划下一轮，同时按复习队列巩固今天的卡片。';
    try {
      const saved = await saveAIStudySummary({
        sessionId: `ai-session-${plan.id}`,
        subjectId: findSubject(plan, learningState.subjects)?.id || plan.subjectId,
        subjectName: plan.subjectName,
        chapterIds,
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
    } catch (err) {
      setSummaryText(summary);
      setAdviceText(advice);
      setError(err instanceof Error ? err.message : '总结已生成，但云端保存失败。');
    } finally {
      setLoading(false);
      setStage('summary');
    }
  };

  const finishChapterReview = async () => {
    const chapterPlan = plan?.chapters[chapterIndex];
    if (!plan || !chapterPlan) return;
    const now = new Date().toISOString();
    const subjectId = findSubject(plan, learningState.subjects)?.id || plan.subjectId;
    const chapterId = resolvedChapterIdsRef.current.get(chapterPlan.id) || chapterPlan.id;
    const fallbackKnowledgePointId = chapterPlan.knowledgePoints
      .map(point => resolvedPointIdsRef.current.get(point.id))
      .filter((id): id is string => Boolean(id))
      .at(-1);
    const answerByOriginalId = new Map(pendingAnswers.map(answer => [answer.question.id, answer]));

    practiceQuestions.forEach((question, index) => {
      const remappedQuestion: Question = {
        ...question,
        id: `ai-synthesis-${chapterId}-${index + 1}`,
        subjectId,
        chapterId,
        knowledgePointId: fallbackKnowledgePointId,
      };
      const answer = answerByOriginalId.get(question.id);
      learningDispatch({ type: 'AI_ADD_GENERATED_QUESTION', payload: remappedQuestion });
      learningDispatch({
        type: 'SAVE_QUESTION_EXPLANATION',
        payload: {
          questionId: remappedQuestion.id,
          explanation: remappedQuestion.explanation,
          createdAt: now,
          updatedAt: now,
          isUserModified: false,
        },
      });
      if (fallbackKnowledgePointId && answer) {
        learningDispatch({
          type: 'RECORD_QUIZ_ANSWER',
          payload: {
            knowledgePointId: fallbackKnowledgePointId,
            questionId: remappedQuestion.id,
            correct: answer.correct,
            score: answer.correct ? 100 : 40,
          },
        });
      }
      if (answer && !answer.correct) {
        learningDispatch({
          type: 'ADD_WRONG_RECORD',
          payload: {
            id: `wr-${remappedQuestion.id}`,
            questionId: remappedQuestion.id,
            wrongAnswers: answer.selectedAnswers,
            correctAnswers: remappedQuestion.correctAnswers,
            addedAt: now,
            reviewedCount: 0,
            lastReviewedAt: null,
          },
        });
      }
    });

    if (chapterIndex < plan.chapters.length - 1) {
      const nextChapterIndex = chapterIndex + 1;
      setChapterIndex(nextChapterIndex);
      setKpIndex(0);
      void startKnowledgePointAt(nextChapterIndex, 0);
      return;
    }
    await finishSession();
  };

  const answerControl = currentQuestion ? (
    <div className="space-y-4">
      <div className="rounded-2xl border p-5" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
        <div className="mb-2 text-sm font-semibold" style={{ color: theme.textMuted }}>
          {stage === 'chapter_review' ? '章节综合题' : `练习 ${questionIndex + 1} / ${practiceQuestions.length}`}
        </div>
        <p className="text-lg font-bold leading-8" style={{ color: theme.textPrimary }}>{currentQuestion.stem}</p>
      </div>
      {currentQuestion.options.map((item, index) => {
        const selected = selectedAnswers.includes(item.id);
        const correctOption = currentQuestion.correctAnswers.includes(item.id);
        const bg = showResult && correctOption ? '#ecfdf5' : showResult && selected ? '#fef2f2' : selected ? `${theme.primary}12` : theme.bgCard;
        const border = showResult && correctOption ? '#86efac' : showResult && selected ? '#fca5a5' : selected ? theme.primary : theme.border;
        return (
          <button
            key={item.id}
            onClick={() => {
              if (showResult) return;
              if (currentQuestion.type !== 'multi_choice') {
                setSelectedAnswers([item.id]);
                return;
              }
              setSelectedAnswers(answers =>
                answers.includes(item.id)
                  ? answers.filter(answer => answer !== item.id)
                  : [...answers, item.id]
              );
            }}
            className="flex min-h-14 w-full items-start gap-3 rounded-2xl border p-4 text-left"
            style={{ backgroundColor: bg, borderColor: border, color: theme.textPrimary }}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: `${theme.primary}18`, color: theme.primary }}>
              {String.fromCharCode(65 + index)}
            </span>
            <span className="text-base leading-7">{item.text}</span>
          </button>
        );
      })}
      {!showResult && (
        <button
          type="button"
          onClick={() => askAboutQuestion(false)}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border text-base font-bold"
          style={{ borderColor: `${theme.primary}55`, backgroundColor: `${theme.primary}0d`, color: theme.primary }}
        >
          <Lightbulb size={18} /> 我不懂，给个提示
        </button>
      )}
      {showResult && (
        <div className="space-y-3 rounded-2xl border p-5 text-base leading-7" style={{ backgroundColor: '#f5f3ff', borderColor: '#ddd6fe', color: '#5b21b6' }}>
          <p>{currentQuestion.explanation}</p>
          <button
            type="button"
            onClick={() => askAboutQuestion(true)}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/80 px-4 text-base font-bold text-violet-700"
          >
            <MessageCircle size={18} /> 深入追问
          </button>
        </div>
      )}
      <button
        onClick={showResult ? (stage === 'chapter_review' ? finishChapterReview : goNext) : submitAnswer}
        disabled={!showResult && selectedAnswers.length === 0}
        className="min-h-12 w-full rounded-2xl px-4 text-base font-bold text-white disabled:opacity-50"
        style={{ backgroundColor: theme.primary }}
      >
        {showResult ? '继续' : '提交答案'}
      </button>
    </div>
  ) : null;

  if (!unlocked) {
    return (
      <div className="h-full min-h-0 overflow-y-auto px-4 py-5" style={{ backgroundColor: theme.bg }}>
        <button onClick={() => navigate('ai-chat')} className="mb-5 flex min-h-11 items-center gap-2 text-base font-semibold" style={{ color: theme.textSecondary }}>
          <ArrowLeft size={18} /> 返回 AI 问答
        </button>
        <div className="rounded-3xl border p-6 text-center" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${theme.primary}16`, color: theme.primary }}>
            <Lock size={28} />
          </div>
          <h1 className="text-xl font-extrabold" style={{ color: theme.textPrimary }}>AI 辅助学习 Lv.{AI_STUDY_UNLOCK_LEVEL} 解锁</h1>
          <p className="mt-3 text-base leading-7" style={{ color: theme.textSecondary }}>
            当前 Lv.{levelProgress.level}，普通 AI 问答仍可使用。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative h-full min-h-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        stage === 'plan' ? 'overflow-hidden' : 'overflow-y-auto'
      }`}
      style={{ backgroundColor: theme.bg }}
    >
      <div className={`mx-auto w-full max-w-4xl px-4 py-5 ${
        stage === 'plan' ? 'flex h-full min-h-0 flex-col' : 'min-h-full'
      }`}>
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => navigate('ai-chat')} className="flex min-h-11 items-center gap-2 text-base font-semibold" style={{ color: theme.textSecondary }}>
            <ArrowLeft size={18} /> 返回 AI 问答
          </button>
          <button onClick={() => navigate('ai-study-summaries')} className="min-h-11 rounded-xl px-4 text-sm font-bold" style={{ backgroundColor: `${theme.primary}12`, color: theme.primary }}>
            学习总结
          </button>
        </div>

        <div className="mb-4 flex min-h-11 items-center gap-2 rounded-2xl border px-4 py-2" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
          <Target size={16} className="shrink-0" style={{ color: theme.primary }} />
          <p className="min-w-0 truncate text-sm font-semibold" style={{ color: theme.textSecondary }}>
            {goal ? `学习目标：${goal}` : '设置本轮学习目标'}
          </p>
        </div>

        {error && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-base text-red-600">
            <span>{error}</span>
            {(stage === 'setup' || stage === 'plan') && (
              <button onClick={buildPlan} className="shrink-0 font-bold">重试</button>
            )}
          </div>
        )}

        {stage === 'setup' && (
          <section className="rounded-3xl border p-5" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
            <label className="text-base font-bold" style={{ color: theme.textPrimary }}>这次想学习什么？</label>
            <textarea
              value={goal}
              onChange={event => setGoal(event.target.value)}
              rows={4}
              placeholder="例如：从零学习物理化学，先掌握热力学基础"
              className="mt-3 w-full resize-none rounded-2xl border bg-transparent p-4 text-base leading-7 outline-none focus:ring-2"
              style={{ borderColor: theme.border, color: theme.textPrimary }}
            />
            <label className="mt-4 block text-base font-bold" style={{ color: theme.textPrimary }}>限定范围（可选）</label>
            <select
              value={scopeSubjectId}
              onChange={event => setScopeSubjectId(event.target.value)}
              className="mt-2 min-h-12 w-full rounded-2xl border bg-transparent p-3 text-base outline-none"
              style={{ borderColor: theme.border, color: theme.textPrimary }}
            >
              <option value="">全部知识库，缺失内容由 AI 生成</option>
              {subjectsWithContent.map(subject => (
                <option key={subject.id} value={subject.id}>{subject.icon} {subject.name}</option>
              ))}
            </select>
            <button
              onClick={buildPlan}
              disabled={loading || !goal.trim()}
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: theme.primary }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
              生成本轮学习计划
            </button>
          </section>
        )}

        {stage === 'plan' && plan && (
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
            <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-3">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: theme.textPrimary }}>确认学习计划</h2>
                  <p className="mt-1 text-sm" style={{ color: theme.textSecondary }}>
                    {plan.subjectIcon} {plan.subjectName} · 可删除不想学的章节或知识点
                  </p>
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
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold" style={{ color: theme.textPrimary }}>{chapter.name}</h3>
                          <span className="rounded-full px-2 py-0.5 text-sm" style={{ backgroundColor: `${theme.primary}12`, color: theme.primary }}>
                            {chapter.source === 'existing' ? '已有内容' : 'AI 生成'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6" style={{ color: theme.textSecondary }}>{chapter.goal}</p>
                      </div>
                      <button onClick={() => removeChapter(chapter.id)} className="min-h-11 shrink-0 px-2 text-sm font-bold text-red-500">移除</button>
                    </div>
                    <div className="space-y-2">
                      {chapter.knowledgePoints.map(kp => (
                        <div key={kp.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: theme.bgCard }}>
                          <span className="min-w-0 text-base" style={{ color: theme.textPrimary }}>
                            {kp.name}
                            <span className="ml-2 text-sm" style={{ color: theme.textMuted }}>
                              {kp.source === 'existing' ? '已有' : '生成'}
                            </span>
                          </span>
                          <button onClick={() => removeKnowledgePoint(chapter.id, kp.id)} className="min-h-11 px-2 text-sm" style={{ color: theme.textMuted }}>删除</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="shrink-0 border-t p-4 backdrop-blur-xl" style={{ borderColor: theme.border, backgroundColor: `${theme.bgCard}ee` }}>
              <button
                onClick={startSession}
                disabled={loading || plan.chapters.length === 0}
                className="min-h-12 w-full rounded-2xl px-4 text-base font-bold text-white disabled:opacity-50"
                style={{ backgroundColor: theme.primary }}
              >
                确认并开始学习
              </button>
            </div>
          </section>
        )}

        {stage === 'explain' && currentPlanKp && studyExplanation && (
          <section className="space-y-4">
            <div className="rounded-3xl border p-5" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
              <div className="mb-2 text-sm font-semibold" style={{ color: theme.textMuted }}>{currentPlanChapter?.name}</div>
              <h2 className="text-2xl font-extrabold" style={{ color: theme.textPrimary }}>{studyExplanation.title}</h2>
              <p className="mt-4 whitespace-pre-wrap text-base leading-8" style={{ color: theme.textSecondary }}>
                <StudyRichText text={studyExplanation.overview} />
              </p>
            </div>

            {studyExplanation.sections.map((section, index) => (
              <article
                key={section.type}
                className="rounded-3xl border p-5"
                style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold"
                    style={{ backgroundColor: `${theme.primary}16`, color: theme.primary }}
                  >
                    {index + 1}
                  </span>
                  <h3 className="text-lg font-extrabold" style={{ color: theme.textPrimary }}>{section.title}</h3>
                </div>
                <p className="mt-4 whitespace-pre-line text-base leading-8" style={{ color: theme.textSecondary }}>
                  <StudyRichText text={section.content} />
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {SECTION_TUTOR_PROMPTS.map(prompt => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => askAboutSection(section.title, section.content, prompt)}
                      className="min-h-11 rounded-full border px-4 text-sm font-bold"
                      style={{ borderColor: `${theme.primary}44`, backgroundColor: `${theme.primary}0d`, color: theme.primary }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </article>
            ))}

            <div className="rounded-2xl p-4 text-base leading-7" style={{ backgroundColor: `${theme.primary}10`, color: theme.primary }}>
              <div className="flex items-start gap-2">
                <Lightbulb size={20} className="mt-1 shrink-0" />
                <span><strong>记忆提示：</strong><StudyRichText text={studyExplanation.memoryTip} /></span>
              </div>
            </div>
            <button
              onClick={() => setStage('practice')}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-bold text-white"
              style={{ backgroundColor: theme.primary }}
            >
              我学会了，开始练习 <ChevronRight size={18} />
            </button>
          </section>
        )}

        {(stage === 'practice' || stage === 'chapter_review') && answerControl}

        {stage === 'summary' && (
          <section className="rounded-3xl border p-5" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-green-600">
              <CheckCircle2 size={26} />
            </div>
            <h2 className="text-2xl font-extrabold" style={{ color: theme.textPrimary }}>本轮学习完成</h2>
            <p className="mt-3 text-base leading-8" style={{ color: theme.textSecondary }}>{summaryText}</p>
            <div className="mt-4 rounded-2xl border p-4 text-base leading-8" style={{ borderColor: theme.border, backgroundColor: theme.bg }}>
              {adviceText}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => navigate('ai-study-summaries')} className="min-h-12 rounded-2xl px-4 text-base font-bold" style={{ backgroundColor: theme.bg, color: theme.textPrimary }}>
                查看总结
              </button>
              <button
                onClick={() => {
                  preparedContentRef.current.clear();
                  setPlan(null);
                  setStage('setup');
                }}
                className="min-h-12 rounded-2xl px-4 text-base font-bold text-white"
                style={{ backgroundColor: theme.primary }}
              >
                继续规划
              </button>
            </div>
          </section>
        )}
      </div>

      {loading && stage !== 'setup' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30">
          <div role="status" aria-live="polite" className="rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-700 shadow-xl">
            <Loader2 className="mr-2 inline animate-spin" size={16} /> 正在思考
          </div>
        </div>
      )}

      {!onOpenTutor && mobileTutorContext && (
        <div className="fixed inset-0 z-[80] flex items-end" role="dialog" aria-modal="true" aria-label="学习导师">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45"
            onClick={() => setMobileTutorContext(null)}
            aria-label="关闭导师遮罩"
          />
          <div className="relative h-[82dvh] w-full overflow-hidden rounded-t-[28px] bg-white shadow-2xl">
            <StudyTutorPanel context={mobileTutorContext} onClose={() => setMobileTutorContext(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
