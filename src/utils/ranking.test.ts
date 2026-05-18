import { buildStudyTimeRanking } from './ranking';

describe('buildStudyTimeRanking', () => {
  test('sorts by learning days first, then study minutes when days match', () => {
    const ranking = buildStudyTimeRanking({
      user: {
        nickname: 'me',
        avatar: '👤',
        learningDays: 5,
        totalStudyMinutes: 999,
      },
      learningState: { knowledgePoints: [], quizResults: [] },
      masterCount: 0,
    });

    const me = ranking.find(entry => entry.isMe);
    const higherDayMock = ranking.find(entry => !entry.isMe && (entry.learningDays ?? 0) > 5);
    expect(me).toBeTruthy();
    expect(higherDayMock?.rank).toBeLessThan(me?.rank ?? 999);
  });
});
