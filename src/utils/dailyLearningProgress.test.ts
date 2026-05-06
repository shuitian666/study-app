import { getTodayLearningProgress } from './dailyLearningProgress';

describe('daily learning progress', () => {
  test('flashcard progress counts Good/Easy scores only', () => {
    const today = new Date().toISOString();
    const progress = getTodayLearningProgress({
      knowledgePoints: [
        {
          id: 'kp1',
          studyRecords: [
            { date: today, type: 'flashcard', score: 40, knowledgePointId: 'kp1' },
            { date: today, type: 'flashcard', score: 60, knowledgePointId: 'kp1' },
          ],
        },
        {
          id: 'kp2',
          studyRecords: [
            { date: today, type: 'flashcard', score: 80, knowledgePointId: 'kp2' },
          ],
        },
        {
          id: 'kp3',
          studyRecords: [
            { date: today, type: 'flashcard', score: 100, knowledgePointId: 'kp3' },
          ],
        },
      ] as any,
      quizResults: [],
    });

    expect(progress.flashcardCount).toBe(2);
    expect(progress.totalCount).toBe(2);
  });
});
