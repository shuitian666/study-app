import { gameReducer, type GameState } from './GameContext';
import type { CheckinRecord, TeamState } from '@/types';

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    checkin: {
      records: [],
      streak: 0,
      makeupCards: 0,
      totalCheckins: 0,
      lotteryPity: { sinceLastSR: 0, sinceLastSSR: 0 },
    },
    achievements: [],
    shopItems: [],
    rankings: { studyTime: [], masterCount: [] },
    achievementPopup: null,
    drawBalance: { regular: 0, up: 0 },
    upPool: {
      id: 'test',
      name: 'test',
      description: 'test',
      banner: '',
      items: [],
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      active: true,
    },
    lastCheckinReward: null,
    team: null,
    lotteryPopup: null,
    redeemedCodes: [],
    ...overrides,
  };
}

function readyTeam(overrides: Partial<TeamState> = {}): TeamState {
  return {
    id: 'team-1',
    inviteCode: 'ABC123',
    status: 'active',
    createdAt: '2026-05-01T00:00:00.000Z',
    todayCheckedIn: false,
    members: [
      {
        id: 'u1',
        name: 'me',
        avatar: '',
        isSimulated: false,
        progress: { taskCompletionRate: 1, studyMinutes: 10, isReady: true, lastUpdated: '2026-05-01T00:00:00.000Z' },
      },
      {
        id: 'u2',
        name: 'mate',
        avatar: '',
        isSimulated: true,
        progress: { taskCompletionRate: 1, studyMinutes: 10, isReady: true, lastUpdated: '2026-05-01T00:00:00.000Z' },
      },
    ],
    ...overrides,
  };
}

describe('gameReducer checkin rewards', () => {
  test('normal checkin grants the 3-day milestone reward', () => {
    const state = baseState({
      checkin: {
        records: [
          { date: '2026-05-08', type: 'normal' },
          { date: '2026-05-09', type: 'normal' },
        ],
        streak: 2,
        makeupCards: 0,
        totalCheckins: 2,
        lotteryPity: { sinceLastSR: 0, sinceLastSSR: 0 },
      },
    });

    const next = gameReducer(state, { type: 'CHECKIN', payload: { date: '2026-05-10', type: 'normal' } });

    expect(next.checkin.streak).toBe(3);
    expect(next.drawBalance).toEqual({ regular: 1, up: 1 });
    expect(next.lastCheckinReward).toMatchObject({ regularTickets: 1, upTickets: 1, streakCoins: 10 });
  });

  test('makeup checkin can trigger a newly reached milestone', () => {
    const state = baseState({
      checkin: {
        records: [
          { date: '2026-05-08', type: 'normal' },
          { date: '2026-05-10', type: 'normal' },
        ],
        streak: 1,
        makeupCards: 1,
        totalCheckins: 2,
        lotteryPity: { sinceLastSR: 0, sinceLastSSR: 0 },
      },
    });

    const next = gameReducer(state, { type: 'CHECKIN', payload: { date: '2026-05-09', type: 'makeup' } });

    expect(next.checkin.streak).toBe(3);
    expect(next.checkin.makeupCards).toBe(0);
    expect(next.drawBalance).toEqual({ regular: 0, up: 1 });
    expect(next.lastCheckinReward).toMatchObject({ regularTickets: 0, upTickets: 1, streakCoins: 10, source: 'makeup' });
  });

  test('makeup checkin is rejected for existing dates or missing cards', () => {
    const existing = baseState({
      checkin: {
        records: [{ date: '2026-05-10', type: 'normal' }],
        streak: 1,
        makeupCards: 1,
        totalCheckins: 1,
        lotteryPity: { sinceLastSR: 0, sinceLastSSR: 0 },
      },
    });
    const noCards = baseState({
      checkin: {
        records: [],
        streak: 0,
        makeupCards: 0,
        totalCheckins: 0,
        lotteryPity: { sinceLastSR: 0, sinceLastSSR: 0 },
      },
    });

    expect(gameReducer(existing, { type: 'CHECKIN', payload: { date: '2026-05-10', type: 'makeup' } })).toBe(existing);
    expect(gameReducer(noCards, { type: 'CHECKIN', payload: { date: '2026-05-09', type: 'makeup' } })).toBe(noCards);
  });

  test('team upgrade only grants the extra regular ticket once', () => {
    const record: CheckinRecord = { date: '2026-05-10', type: 'normal' };
    const state = baseState({
      checkin: {
        records: [record],
        streak: 1,
        makeupCards: 0,
        totalCheckins: 1,
        lotteryPity: { sinceLastSR: 0, sinceLastSSR: 0 },
      },
      team: readyTeam(),
      drawBalance: { regular: 1, up: 0 },
    });

    const upgraded = gameReducer(state, {
      type: 'UPGRADE_TODAY_CHECKIN_TO_TEAM',
      payload: { date: '2026-05-10', teamId: 'team-1' },
    });
    const repeated = gameReducer(upgraded, {
      type: 'UPGRADE_TODAY_CHECKIN_TO_TEAM',
      payload: { date: '2026-05-10', teamId: 'team-1' },
    });

    expect(upgraded.checkin.records[0]).toMatchObject({ type: 'team', teamId: 'team-1' });
    expect(upgraded.drawBalance.regular).toBe(2);
    expect(upgraded.team?.todayCheckedIn).toBe(true);
    expect(repeated).toBe(upgraded);
  });

  test('direct team checkin grants normal plus team ticket', () => {
    const state = baseState({ team: readyTeam() });

    const next = gameReducer(state, { type: 'CHECKIN', payload: { date: '2026-05-10', type: 'team', teamId: 'team-1' } });

    expect(next.drawBalance.regular).toBe(2);
    expect(next.checkin.records[0]).toMatchObject({ type: 'team', teamId: 'team-1' });
    expect(next.team?.todayCheckedIn).toBe(true);
  });
});
