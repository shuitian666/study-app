import type { Achievement, CheckinState } from '@/types';
import type { LearningState } from '@/store/LearningContext';

export function calculateLearningExperience(
  learningState: Pick<LearningState, 'knowledgePoints' | 'quizResults'>,
  checkinState: Pick<CheckinState, 'totalCheckins'>,
): number {
  const flashcardAttempts = learningState.knowledgePoints.reduce(
    (sum, knowledgePoint) => sum + (knowledgePoint.studyRecords?.length ?? 0),
    0,
  );
  const quizQuestions = learningState.quizResults.reduce(
    (sum, result) => sum + result.totalQuestions,
    0,
  );
  const masteredCount = learningState.knowledgePoints.filter(
    knowledgePoint => knowledgePoint.proficiency === 'master',
  ).length;

  return flashcardAttempts * 10 + quizQuestions * 3 + masteredCount * 10 + checkinState.totalCheckins * 20;
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
      return learningState.knowledgePoints.length >= condition.value;
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
