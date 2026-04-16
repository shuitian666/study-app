import type { LearningState } from '@/store/LearningContext';

export function getLocalDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayLearningProgress(
  learningState: Pick<LearningState, 'knowledgePoints' | 'quizResults'>,
) {
  const todayKey = getLocalDateKey(new Date());
  const flashcardKnowledgeIds = new Set<string>();
  let reviewQuestionCount = 0;

  learningState.knowledgePoints.forEach(knowledgePoint => {
    (knowledgePoint.studyRecords || []).forEach(record => {
      if (getLocalDateKey(record.date) === todayKey) {
        flashcardKnowledgeIds.add(record.knowledgePointId || knowledgePoint.id);
      }
    });

    (knowledgePoint.quizRecords || []).forEach(record => {
      if (getLocalDateKey(record.date) === todayKey) {
        reviewQuestionCount += 1;
      }
    });
  });

  const quizSessionQuestionCount = learningState.quizResults
    .filter(result => getLocalDateKey(result.completedAt) === todayKey)
    .reduce((sum, result) => sum + result.totalQuestions, 0);

  const flashcardCount = flashcardKnowledgeIds.size;
  const totalCount = flashcardCount + reviewQuestionCount + quizSessionQuestionCount;

  return {
    todayKey,
    flashcardCount,
    reviewQuestionCount,
    quizSessionQuestionCount,
    totalCount,
  };
}
