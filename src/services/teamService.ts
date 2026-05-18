import type { TeamMemberProgress, TeamState } from '@/types';
import { API_BASE } from './aiClient';

function initialProgress(): TeamMemberProgress {
  return {
    taskCompletionRate: 0,
    studyMinutes: 0,
    isReady: false,
    lastUpdated: new Date().toISOString(),
  };
}

function normalizeTeam(data: TeamState): TeamState {
  return {
    ...data,
    members: (data.members || []).map(member => ({
      ...member,
      progress: member.progress || initialProgress(),
    })),
    todayCheckedIn: Boolean(data.todayCheckedIn),
  };
}

async function teamRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const message = (await response.json().catch(() => null))?.error || 'Team request failed';
    throw new Error(message);
  }

  return response.json();
}

export async function createTeam(userId: string, userName: string, userAvatar: string): Promise<TeamState> {
  const data = await teamRequest<{ team: TeamState }>('/team/create', { userId, userName, userAvatar });
  return normalizeTeam(data.team);
}

export async function joinTeamByCode(inviteCode: string, userId: string, userName: string, userAvatar: string): Promise<TeamState> {
  const data = await teamRequest<{ team: TeamState }>('/team/join', {
    inviteCode: inviteCode.trim().toUpperCase(),
    userId,
    userName,
    userAvatar,
  });
  return normalizeTeam(data.team);
}

export async function dissolveTeam(teamId: string): Promise<void> {
  await teamRequest<{ ok: true }>('/team/dissolve', { teamId });
}

export async function updateTeamProgress(
  teamId: string,
  userId: string,
  progress: { taskCompletionRate: number; studyMinutes: number; isReady: boolean }
): Promise<TeamState> {
  const data = await teamRequest<{ team: TeamState }>('/team/progress', { teamId, userId, progress });
  return normalizeTeam(data.team);
}

export async function getTeamByCode(inviteCodeOrTeamId: string): Promise<TeamState | null> {
  const response = await fetch(`${API_BASE}/team/${encodeURIComponent(inviteCodeOrTeamId)}`, { credentials: 'include' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Failed to get team');
  const data = await response.json();
  return data ? normalizeTeam(data) : null;
}

export function pollTeamStatus(teamId: string, callback: (team: TeamState) => void, interval = 5000): () => void {
  let stopped = false;
  let timer: number | undefined;

  const poll = async () => {
    if (stopped) return;
    try {
      const team = await getTeamByCode(teamId);
      if (team) callback(team);
    } catch (error) {
      console.warn('Poll failed:', error);
    } finally {
      if (!stopped) {
        timer = window.setTimeout(poll, interval);
      }
    }
  };

  void poll();

  return () => {
    stopped = true;
    if (timer) window.clearTimeout(timer);
  };
}
