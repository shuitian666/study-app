import type { LearningState } from '@/store/LearningContext';
import type { RankEntry, User } from '@/types';
import { MOCK_RANKINGS } from '@/data/incentive-mock';

const MINUTES_PER_LEARNING_ITEM = 3;

type RankingUserInput = Pick<User, 'nickname' | 'avatar' | 'avatarFrame' | 'learningDays' | 'totalStudyMinutes'> | null | undefined;

function uniqueCount(values: string[]) {
  return new Set(values.filter(Boolean)).size;
}

export function estimateStudyMinutes(learningState: Pick<LearningState, 'knowledgePoints' | 'quizResults'>, fallbackMinutes = 0) {
  const flashcardRecords = learningState.knowledgePoints.flatMap(point =>
    (point.studyRecords || []).map(record => `${record.date}:${record.knowledgePointId || point.id}`)
  );
  const reviewRecords = learningState.knowledgePoints.flatMap(point =>
    (point.quizRecords || []).map((record, index) => `${record.date}:${record.questionId || point.id}:${index}`)
  );
  const quizQuestionCount = learningState.quizResults.reduce((sum, result) => sum + result.totalQuestions, 0);
  const completedItems = uniqueCount(flashcardRecords) + uniqueCount(reviewRecords) + quizQuestionCount;
  return Math.max(fallbackMinutes, completedItems * MINUTES_PER_LEARNING_ITEM);
}

function withRanks(entries: Omit<RankEntry, 'rank'>[]): RankEntry[] {
  return entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function buildStudyTimeRanking(params: {
  user: RankingUserInput;
  learningState: Pick<LearningState, 'knowledgePoints' | 'quizResults'>;
  masterCount: number;
}) {
  const currentStudyMinutes = estimateStudyMinutes(params.learningState, params.user?.totalStudyMinutes ?? 0);
  const currentUser: Omit<RankEntry, 'rank'> = {
    nickname: params.user?.nickname?.trim() || '我',
    avatar: params.user?.avatar || '👤',
    avatarFrame: params.user?.avatarFrame || undefined,
    value: currentStudyMinutes,
    learningDays: params.user?.learningDays ?? 0,
    studyMinutes: currentStudyMinutes,
    masterCount: params.masterCount,
    isMe: true,
  };

  const mockUsers = MOCK_RANKINGS.studyTime
    .filter(entry => !entry.isMe)
    .map(entry => ({
      ...entry,
      value: entry.value,
      learningDays: entry.learningDays ?? Math.max(1, Math.round(entry.value / 30)),
      studyMinutes: entry.studyMinutes ?? entry.value,
      masterCount: entry.masterCount ?? 0,
      isMe: false,
    }));

  return withRanks([...mockUsers, currentUser].sort((a, b) =>
    (b.learningDays ?? 0) - (a.learningDays ?? 0) ||
    (b.studyMinutes ?? b.value) - (a.studyMinutes ?? a.value) ||
    (b.masterCount ?? 0) - (a.masterCount ?? 0)
  ));
}

export function buildMasterCountRanking(params: {
  user: RankingUserInput;
  masterCount: number;
  studyMinutes: number;
}) {
  const currentUser: Omit<RankEntry, 'rank'> = {
    nickname: params.user?.nickname?.trim() || '我',
    avatar: params.user?.avatar || '👤',
    avatarFrame: params.user?.avatarFrame || undefined,
    value: params.masterCount,
    learningDays: params.user?.learningDays ?? 0,
    studyMinutes: params.studyMinutes,
    masterCount: params.masterCount,
    isMe: true,
  };

  const mockUsers = MOCK_RANKINGS.masterCount
    .filter(entry => !entry.isMe)
    .map(entry => ({
      ...entry,
      masterCount: entry.masterCount ?? entry.value,
      learningDays: entry.learningDays ?? Math.max(1, Math.round(entry.value / 8)),
      studyMinutes: entry.studyMinutes ?? entry.value * 12,
      isMe: false,
    }));

  return withRanks([...mockUsers, currentUser].sort((a, b) =>
    (b.masterCount ?? b.value) - (a.masterCount ?? a.value) ||
    (b.learningDays ?? 0) - (a.learningDays ?? 0) ||
    (b.studyMinutes ?? 0) - (a.studyMinutes ?? 0)
  ));
}
