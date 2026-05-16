import type { Achievement, CheckinState } from '@/types';
import type { LearningState } from '@/store/LearningContext';
import {
  DAILY_LIMITED_EXPERIENCE_CAP,
  FLASHCARD_EXPERIENCE,
  MASTERY_EXPERIENCE,
  QUIZ_QUESTION_EXPERIENCE,
  getLocalDateKey,
} from '@/utils/experience';

type KnowledgePointForAchievement = Pick<LearningState['knowledgePoints'][number], 'id' | 'source'>;

export function isUserAddedKnowledgePoint(knowledgePoint: KnowledgePointForAchievement): boolean {
  if (knowledgePoint.source === 'manual' || knowledgePoint.source === 'ai') {
    return true;
  }

  return knowledgePoint.source === 'import' && knowledgePoint.id.startsWith('kp-import-');
}

export function calculateLearningExperience(
  learningState: Pick<LearningState, 'knowledgePoints' | 'quizResults'>,
  checkinState: Pick<CheckinState, 'totalCheckins'>,
): number {
  void checkinState;
  const dailyExperience = new Map<string, number>();

  const addDailyExperience = (dateValue: string | null | undefined, amount: number) => {
    if (!dateValue || amount <= 0) return;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return;
    const dateKey = getLocalDateKey(date);
    const used = dailyExperience.get(dateKey) ?? 0;
    dailyExperience.set(dateKey, Math.min(DAILY_LIMITED_EXPERIENCE_CAP, used + amount));
  };

  learningState.knowledgePoints.forEach(knowledgePoint => {
    knowledgePoint.studyRecords?.forEach(record => {
      addDailyExperience(record.date, FLASHCARD_EXPERIENCE);
    });

    knowledgePoint.quizRecords?.forEach(record => {
      addDailyExperience(record.date, QUIZ_QUESTION_EXPERIENCE);
    });

    if (knowledgePoint.masteredAt || knowledgePoint.proficiency === 'master') {
      addDailyExperience(knowledgePoint.masteredAt ?? knowledgePoint.lastReviewedAt ?? knowledgePoint.createdAt, MASTERY_EXPERIENCE);
    }
  });

  learningState.quizResults.forEach(result => {
    addDailyExperience(result.completedAt, result.totalQuestions * QUIZ_QUESTION_EXPERIENCE);
  });

  return Array.from(dailyExperience.values()).reduce((sum, amount) => sum + amount, 0);
}

export function calculateLearningExperienceForDate(
  learningState: Pick<LearningState, 'knowledgePoints' | 'quizResults'>,
  dateKey: string,
): number {
  let total = 0;
  const add = (dateValue: string | null | undefined, amount: number) => {
    if (!dateValue || total >= DAILY_LIMITED_EXPERIENCE_CAP) return;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime()) || getLocalDateKey(date) !== dateKey) return;
    total = Math.min(DAILY_LIMITED_EXPERIENCE_CAP, total + amount);
  };

  learningState.knowledgePoints.forEach(knowledgePoint => {
    knowledgePoint.studyRecords?.forEach(record => add(record.date, FLASHCARD_EXPERIENCE));
    knowledgePoint.quizRecords?.forEach(record => add(record.date, QUIZ_QUESTION_EXPERIENCE));
    if (knowledgePoint.masteredAt || knowledgePoint.proficiency === 'master') {
      add(knowledgePoint.masteredAt ?? knowledgePoint.lastReviewedAt ?? knowledgePoint.createdAt, MASTERY_EXPERIENCE);
    }
  });

  learningState.quizResults.forEach(result => {
    add(result.completedAt, result.totalQuestions * QUIZ_QUESTION_EXPERIENCE);
  });

  return total;
}

export function isAchievementConditionMet(
  achievement: Achievement,
  learningState: Pick<LearningState, 'knowledgePoints' | 'quizResults' | 'wrongRecords' | 'todayReviewItems' | 'todayNewItems'>,
  checkinState: Pick<CheckinState, 'records' | 'streak' | 'totalCheckins'>,
): boolean {
  const { condition } = achievement;
  const masteredCount = learningState.knowledgePoints.filter(
    knowledgePoint => knowledgePoint.proficiency === 'master',
  ).length;
  const hasLearnedKnowledge = learningState.knowledgePoints.some(
    knowledgePoint => (knowledgePoint.reviewCount ?? 0) > 0 || (knowledgePoint.studyRecords?.length ?? 0) > 0,
  );
  const hasCompletedTodayPlan = [...learningState.todayReviewItems, ...learningState.todayNewItems].some(
    item => item.completed,
  );
  const perfectQuizCount = learningState.quizResults.filter(result => result.score === 100).length;
  const makeupUsedCount = checkinState.records.filter(record => record.type === 'makeup').length;
  const hasRecoveredFromMistakes = learningState.quizResults.some(result => result.score < 100)
    && learningState.wrongRecords.length === 0;
  const userAddedKnowledgeCount = learningState.knowledgePoints.filter(isUserAddedKnowledgePoint).length;

  switch (condition.type) {
    case 'first_learn':
      return (hasLearnedKnowledge || hasCompletedTodayPlan) && condition.value <= 1;
    case 'first_checkin':
      return checkinState.totalCheckins >= condition.value;
    case 'streak_days':
      return checkinState.streak >= condition.value;
    case 'master_count':
      return masteredCount >= condition.value;
    case 'perfect_quiz':
      return perfectQuizCount >= condition.value;
    case 'clear_wrong':
      return hasRecoveredFromMistakes && condition.value <= 1;
    case 'total_knowledge':
      return userAddedKnowledgeCount >= condition.value;
    case 'total_checkins':
      return checkinState.totalCheckins >= condition.value;
    case 'total_quizzes':
      return learningState.quizResults.length >= condition.value;
    case 'makeup_used':
      return makeupUsedCount >= condition.value;
    case 'one_session_correct':
      return perfectQuizCount >= condition.value;
  }

  return false;
}
