import type {
  AILearningContext,
  AIKnowledgePointContext,
  AIWrongQuestionContext,
  Chapter,
  KnowledgePointExtended,
  Question,
  ReviewItem,
  Subject,
  User,
  UserLearningProfile,
  WrongRecord,
} from '@/types';

const FOCUS_LIMIT = 6;
const SUPPORT_LIMIT = 4;
const EXPLANATION_LIMIT = 180;
const WRONG_STEM_LIMIT = 160;

export const DEFAULT_LEARNING_PROFILE: UserLearningProfile = {
  goals: ['daily_review'],
  studyDirection: 'general',
  explanationStyle: 'step_by_step',
  preferredDifficulty: 'standard',
  practicePreference: 'explain_then_practice',
  updatedAt: '',
};

interface BuildAILearningContextParams {
  query?: string;
  user?: User | null;
  subjects: Subject[];
  chapters: Chapter[];
  knowledgePoints: KnowledgePointExtended[];
  questions: Question[];
  wrongRecords: WrongRecord[];
  todayReviewItems: ReviewItem[];
  todayNewItems: ReviewItem[];
}

const PROFICIENCY_SCORE: Record<KnowledgePointExtended['proficiency'], number> = {
  none: 0,
  rusty: 1,
  normal: 2,
  master: 3,
};

function isDeleted(item: { deletedAt?: string | null }): boolean {
  return Boolean(item.deletedAt);
}

function clampText(value: string | undefined, limit = EXPLANATION_LIMIT): string | undefined {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

export function normalizeLearningProfile(profile?: Partial<UserLearningProfile> | null): UserLearningProfile {
  const validGoals = new Set(['daily_review', 'exam_cram', 'foundation', 'weakness_fix']);
  const goals = Array.isArray(profile?.goals)
    ? profile.goals.filter(goal => validGoals.has(goal)).slice(0, 3)
    : [];

  return {
    goals: goals.length > 0 ? goals as UserLearningProfile['goals'] : DEFAULT_LEARNING_PROFILE.goals,
    studyDirection: ['medical', 'pharmacy', 'nursing', 'english', 'general'].includes(String(profile?.studyDirection))
      ? profile!.studyDirection!
      : DEFAULT_LEARNING_PROFILE.studyDirection,
    explanationStyle: ['concise', 'step_by_step', 'analogy', 'exam_oriented'].includes(String(profile?.explanationStyle))
      ? profile!.explanationStyle!
      : DEFAULT_LEARNING_PROFILE.explanationStyle,
    preferredDifficulty: ['basic', 'standard', 'challenge'].includes(String(profile?.preferredDifficulty))
      ? profile!.preferredDifficulty!
      : DEFAULT_LEARNING_PROFILE.preferredDifficulty,
    practicePreference: ['explain_then_practice', 'quiz_then_explain', 'wrong_only'].includes(String(profile?.practicePreference))
      ? profile!.practicePreference!
      : DEFAULT_LEARNING_PROFILE.practicePreference,
    updatedAt: typeof profile?.updatedAt === 'string' ? profile.updatedAt : '',
  };
}

function getDateValue(value: string | null | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isDue(value: string | null | undefined, now = Date.now()): boolean {
  const time = getDateValue(value);
  return time > 0 && time <= now;
}

function tokenize(value: string): string[] {
  const normalized = value.toLowerCase();
  const words = normalized.match(/[a-z0-9]+|[\u4e00-\u9fff]{2,}/g) || [];
  const chineseChars = normalized.match(/[\u4e00-\u9fff]/g) || [];
  return [...new Set([...words, ...chineseChars])].filter(token => token.length > 0);
}

function textMatchScore(query: string, kp: KnowledgePointExtended): number {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return 0;

  const name = kp.name.toLowerCase();
  const explanation = kp.explanation.toLowerCase();
  let score = 0;

  if (name && normalizedQuery.includes(name)) score += 80;
  if (name && name.includes(normalizedQuery)) score += 60;
  if (explanation && explanation.includes(normalizedQuery)) score += 25;

  for (const token of tokenize(normalizedQuery)) {
    if (token.length <= 1) {
      if (name.includes(token)) score += 3;
      continue;
    }
    if (name.includes(token)) score += 14;
    if (explanation.includes(token)) score += 5;
  }

  return score;
}

function masteryLevel(kp: KnowledgePointExtended): number {
  if (typeof kp.currentScore === 'number' && Number.isFinite(kp.currentScore)) {
    return Math.max(0, Math.min(100, Math.round(kp.currentScore)));
  }
  return Math.round((PROFICIENCY_SCORE[kp.proficiency] / 3) * 100);
}

function contextForKnowledgePoint(
  kp: KnowledgePointExtended,
  maps: {
    subjects: Map<string, Subject>;
    chapters: Map<string, Chapter>;
    wrongCounts: Map<string, number>;
  },
  reason?: string,
): AIKnowledgePointContext {
  return {
    id: kp.id,
    name: kp.name,
    subjectName: maps.subjects.get(kp.subjectId)?.name,
    chapterName: maps.chapters.get(kp.chapterId)?.name,
    explanation: clampText(kp.explanation),
    proficiency: kp.proficiency,
    masteryLevel: masteryLevel(kp),
    wrongCount: maps.wrongCounts.get(kp.id) || 0,
    reviewCount: kp.reviewCount || 0,
    currentScore: typeof kp.currentScore === 'number' ? Math.round(kp.currentScore) : undefined,
    lastReviewedAt: kp.lastReviewedAt,
    nextReviewAt: kp.nextReviewAt,
    reason,
  };
}

function getWrongCounts(wrongRecords: WrongRecord[], questions: Question[]): Map<string, number> {
  const questionToKp = new Map(questions.map(question => [question.id, question.knowledgePointId]));
  const counts = new Map<string, number>();

  for (const record of wrongRecords) {
    const kpId = questionToKp.get(record.questionId);
    if (!kpId) continue;
    counts.set(kpId, (counts.get(kpId) || 0) + 1);
  }

  return counts;
}

function inferLearningProfile(params: {
  weakKnowledgePoints: AIKnowledgePointContext[];
  dueReviews: AIKnowledgePointContext[];
  recentWrongQuestions: AIWrongQuestionContext[];
}) {
  const weakPatterns = new Set<string>();

  if (params.weakKnowledgePoints.some(kp => kp.proficiency === 'none' || kp.proficiency === 'rusty')) {
    weakPatterns.add('low_mastery');
  }
  if (params.weakKnowledgePoints.some(kp => kp.wrongCount >= 2) || params.recentWrongQuestions.length >= 2) {
    weakPatterns.add('repeated_mistakes');
  }
  if (params.dueReviews.length > 0) {
    weakPatterns.add('review_overdue');
  }
  if (params.recentWrongQuestions.some(item => item.reviewedCount > 0)) {
    weakPatterns.add('needs_error_review');
  }

  const areaCounts = new Map<string, number>();
  for (const kp of params.weakKnowledgePoints) {
    const key = kp.chapterName || kp.subjectName || kp.name;
    areaCounts.set(key, (areaCounts.get(key) || 0) + 1 + kp.wrongCount);
  }

  const stableWeakAreas = [...areaCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name)
    .slice(0, 3);

  return {
    weakPatterns: [...weakPatterns].slice(0, 4),
    stableWeakAreas,
  };
}

export function rankKnowledgePointsForAI(params: {
  query?: string;
  knowledgePoints: KnowledgePointExtended[];
  wrongRecords: WrongRecord[];
  questions: Question[];
  limit?: number;
}): Array<{ knowledgePoint: KnowledgePointExtended; score: number; reason: string }> {
  const wrongCounts = getWrongCounts(params.wrongRecords, params.questions);
  const now = Date.now();

  return params.knowledgePoints
    .filter(kp => !isDeleted(kp))
    .map(kp => {
      const wrongCount = wrongCounts.get(kp.id) || 0;
      const due = isDue(kp.nextReviewAt, now);
      const weak = kp.proficiency === 'none' || kp.proficiency === 'rusty';
      const newCard = (kp.reviewCount || 0) === 0 || !kp.lastReviewedAt;
      const queryScore = textMatchScore(params.query || '', kp);
      const score =
        queryScore +
        wrongCount * 18 +
        (due ? 22 : 0) +
        (weak ? 18 : 0) +
        (newCard ? 8 : 0) -
        PROFICIENCY_SCORE[kp.proficiency] * 2;

      const reasons = [
        queryScore > 0 ? 'matches the current question' : '',
        wrongCount > 0 ? `${wrongCount} recent wrong record(s)` : '',
        due ? 'due for review' : '',
        weak ? 'low mastery' : '',
        newCard ? 'new or barely reviewed' : '',
      ].filter(Boolean);

      return {
        knowledgePoint: kp,
        score,
        reason: reasons.join(', ') || 'available learning context',
      };
    })
    .sort((a, b) => b.score - a.score || a.knowledgePoint.name.localeCompare(b.knowledgePoint.name))
    .slice(0, params.limit ?? FOCUS_LIMIT);
}

export function buildAILearningContext(params: BuildAILearningContextParams): AILearningContext {
  const activeKnowledgePoints = params.knowledgePoints.filter(kp => !isDeleted(kp));
  const activeQuestions = params.questions.filter(question => !isDeleted(question));
  const subjects = new Map(params.subjects.map(subject => [subject.id, subject]));
  const chapters = new Map(params.chapters.map(chapter => [chapter.id, chapter]));
  const questions = new Map(activeQuestions.map(question => [question.id, question]));
  const knowledgePoints = new Map(activeKnowledgePoints.map(kp => [kp.id, kp]));
  const wrongCounts = getWrongCounts(params.wrongRecords, activeQuestions);
  const maps = { subjects, chapters, wrongCounts };

  const ranked = rankKnowledgePointsForAI({
    query: params.query,
    knowledgePoints: activeKnowledgePoints,
    wrongRecords: params.wrongRecords,
    questions: activeQuestions,
    limit: FOCUS_LIMIT,
  });

  const weakKnowledgePoints = [...activeKnowledgePoints]
    .filter(kp => kp.proficiency === 'none' || kp.proficiency === 'rusty' || (wrongCounts.get(kp.id) || 0) > 0)
    .sort((a, b) => {
      const aScore = (wrongCounts.get(a.id) || 0) * 10 + (3 - PROFICIENCY_SCORE[a.proficiency]);
      const bScore = (wrongCounts.get(b.id) || 0) * 10 + (3 - PROFICIENCY_SCORE[b.proficiency]);
      return bScore - aScore;
    })
    .slice(0, SUPPORT_LIMIT)
    .map(kp => contextForKnowledgePoint(kp, maps, 'weak or error-prone'));

  const dueReviewIds = new Set(
    params.todayReviewItems
      .filter(item => !item.completed)
      .map(item => item.knowledgePointId),
  );
  const dueReviews = activeKnowledgePoints
    .filter(kp => dueReviewIds.has(kp.id) || isDue(kp.nextReviewAt))
    .sort((a, b) => getDateValue(a.nextReviewAt) - getDateValue(b.nextReviewAt))
    .slice(0, SUPPORT_LIMIT)
    .map(kp => contextForKnowledgePoint(kp, maps, 'due for review'));

  const recentWrongQuestions: AIWrongQuestionContext[] = [...params.wrongRecords]
    .sort((a, b) => getDateValue(b.addedAt) - getDateValue(a.addedAt))
    .slice(0, SUPPORT_LIMIT)
    .map(record => {
      const question = questions.get(record.questionId);
      const kp = question?.knowledgePointId ? knowledgePoints.get(question.knowledgePointId) : undefined;
      return {
        id: record.id,
        questionId: record.questionId,
        knowledgePointId: question?.knowledgePointId,
        knowledgePointName: kp?.name,
        stem: clampText(question?.stem, WRONG_STEM_LIMIT),
        wrongAnswers: record.wrongAnswers,
        correctAnswers: record.correctAnswers,
        reviewedCount: record.reviewedCount,
        addedAt: record.addedAt,
        lastReviewedAt: record.lastReviewedAt,
      };
    });

  return {
    profile: {
      nickname: params.user?.nickname,
      dailyGoal: params.user?.dailyGoal,
      dailyNewGoal: params.user?.dailyNewGoal,
      learningProfile: normalizeLearningProfile(params.user?.learningProfile),
      inferredProfile: inferLearningProfile({
        weakKnowledgePoints,
        dueReviews,
        recentWrongQuestions,
      }),
    },
    focusKnowledgePoints: ranked.map(item => contextForKnowledgePoint(item.knowledgePoint, maps, item.reason)),
    weakKnowledgePoints,
    dueReviews,
    recentWrongQuestions,
    todayProgress: {
      reviewDone: params.todayReviewItems.filter(item => item.completed).length,
      reviewTotal: params.todayReviewItems.length,
      newDone: params.todayNewItems.filter(item => item.completed).length,
      newTotal: params.todayNewItems.length,
    },
    generatedAt: new Date().toISOString(),
  };
}
