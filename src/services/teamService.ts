import type { TeamState } from '@/types';
import { createSimulatedTeammate, generateInviteCode } from './teamSimulator';

const API_BASE = 'http://localhost:3001';

// 切换模式：true = 使用真实API, false = 使用模拟
const USE_REAL_API = true;

/**
 * Team service abstraction layer.
 * Supports both real backend API and local simulation.
 */

export async function createTeam(userId: string, userName: string, userAvatar: string): Promise<TeamState> {
  if (USE_REAL_API) {
    try {
      const response = await fetch(`${API_BASE}/api/team/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userName, userAvatar }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create team');
      }
      
      const data = await response.json();
      return {
        id: data.teamId,
        inviteCode: data.inviteCode,
        members: [{
          id: userId,
          name: userName,
          avatar: userAvatar,
          isSimulated: false,
          progress: { taskCompletionRate: 0, studyMinutes: 0, isReady: false, lastUpdated: new Date().toISOString() },
        }],
        status: 'waiting',
        createdAt: new Date().toISOString(),
        todayCheckedIn: false,
      };
    } catch (error) {
      console.warn('Real API failed, falling back to simulation:', error);
      // Fall through to simulation
    }
  }
  
  // Simulation fallback
  await new Promise(r => setTimeout(r, 300));
  return {
    id: `team-${Date.now()}`,
    inviteCode: generateInviteCode(),
    members: [
      {
        id: userId,
        name: userName,
        avatar: userAvatar,
        isSimulated: false,
        progress: { taskCompletionRate: 0, studyMinutes: 0, isReady: false, lastUpdated: new Date().toISOString() },
      },
    ],
    status: 'waiting',
    createdAt: new Date().toISOString(),
    todayCheckedIn: false,
  };
}

export async function joinTeamByCode(inviteCode: string, userId: string, userName: string, userAvatar: string): Promise<TeamState> {
  if (USE_REAL_API) {
    try {
      const response = await fetch(`${API_BASE}/api/team/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode, userId, userName, userAvatar }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to join team');
      }
      
      const data = await response.json();
      return {
        id: data.teamId,
        inviteCode: data.inviteCode,
        members: data.members.map((m: { id: string; name: string; avatar: string; isSimulated: boolean }) => ({
          id: m.id,
          name: m.name,
          avatar: m.avatar,
          isSimulated: m.isSimulated,
          progress: { taskCompletionRate: 0, studyMinutes: 0, isReady: false, lastUpdated: new Date().toISOString() },
        })),
        status: data.status,
        createdAt: data.createdAt,
        todayCheckedIn: false,
      };
    } catch (error) {
      console.warn('Real API failed, falling back to simulation:', error);
      // Fall through to simulation
    }
  }
  
  // Simulation fallback
  await new Promise(r => setTimeout(r, 500));
  
  // Add self to a simulated team
  const teammate = createSimulatedTeammate();
  return {
    id: `team-${Date.now()}`,
    inviteCode,
    members: [
      {
        id: userId,
        name: userName,
        avatar: userAvatar,
        isSimulated: false,
        progress: { taskCompletionRate: 0, studyMinutes: 0, isReady: false, lastUpdated: new Date().toISOString() },
      },
      teammate,
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    todayCheckedIn: false,
  };
}

export async function dissolveTeam(teamId: string): Promise<void> {
  if (USE_REAL_API) {
    try {
      await fetch(`${API_BASE}/api/team/dissolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      });
    } catch (error) {
      console.warn('Failed to notify server about team dissolution:', error);
    }
  }
}

export async function updateTeamProgress(
  teamId: string,
  userId: string,
  progress: { taskCompletionRate: number; studyMinutes: number; isReady: boolean }
): Promise<void> {
  if (USE_REAL_API) {
    try {
      await fetch(`${API_BASE}/api/team/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, userId, progress }),
      });
    } catch (error) {
      console.warn('Failed to update team progress:', error);
    }
  }
}

export async function getTeamByCode(inviteCode: string): Promise<TeamState | null> {
  if (USE_REAL_API) {
    try {
      const response = await fetch(`${API_BASE}/api/team/${inviteCode}`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.warn('Failed to get team:', error);
      return null;
    }
  }
  return null;
}

// 轮询获取队伍状态（用于真实API模式）
export async function pollTeamStatus(teamId: string, callback: (team: TeamState) => void, interval = 5000): Promise<() => void> {
  let stopped = false;
  
  const poll = async () => {
    if (stopped) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/team/${teamId}`);
      if (response.ok) {
        const team = await response.json();
        callback(team);
      }
    } catch (error) {
      console.warn('Poll failed:', error);
    }
    
    if (!stopped) {
      setTimeout(poll, interval);
    }
  };
  
  poll();
  
  // 返回停止函数
  return () => {
    stopped = true;
  };
}
