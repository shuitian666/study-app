import type { TeamMember, TeamMemberProgress } from '@/types';

const TEAMMATE_NAMES = [
  '小明', '学习达人', '每日一练', '知识探索者', '勤学好问',
  '拼命三郎', '日积月累', '好学少年', '悄悄努力', '追光者',
];

const TEAMMATE_AVATARS = ['🦊', '🐻', '🐰', '🐱', '🐶', '🐼', '🐸', '🐵', '🦁', '🐧'];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function createSimulatedTeammate(): TeamMember {
  return {
    id: `sim-${Date.now()}`,
    name: randomFrom(TEAMMATE_NAMES),
    avatar: randomFrom(TEAMMATE_AVATARS),
    isSimulated: true,
    progress: {
      taskCompletionRate: 0,
      studyMinutes: 0,
      isReady: false,
      lastUpdated: new Date().toISOString(),
    },
  };
}

export interface SimulationHandle {
  stop: () => void;
}

/**
 * Start simulating teammate progress over time.
 * - 15% chance teammate gets "stuck" at 60-75%
 * - Otherwise progresses to 100% in 3-15 min (simulated in accelerated time)
 * - Calls onUpdate with new progress periodically
 */
export function startTeammateSimulation(
  onUpdate: (progress: TeamMemberProgress) => void,
  onJoin?: () => void,
): SimulationHandle {
  let rate = 0;
  const isStuck = Math.random() < 0.15;
  const stuckCap = isStuck ? randomBetween(0.60, 0.75) : 1.0;
  const baseSpeed = randomBetween(0.03, 0.06); // rate per update tick
  let joinTimeout: ReturnType<typeof setTimeout> | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;
  let minutes = 0;

  // Teammate "joins" after 3-8 seconds
  const joinDelay = randomBetween(3000, 8000);
  joinTimeout = setTimeout(() => {
    onJoin?.();
    // Start progress updates every 2-4 seconds (accelerated for demo)
    const updateInterval = randomBetween(2000, 4000);
    interval = setInterval(() => {
      const noise = randomBetween(-0.02, 0.03);
      rate = Math.min(stuckCap, rate + baseSpeed + noise);
      minutes += randomBetween(1, 3);
      const isReady = rate >= 0.8;
      onUpdate({
        taskCompletionRate: Math.round(rate * 100) / 100,
        studyMinutes: Math.round(minutes),
        isReady,
        lastUpdated: new Date().toISOString(),
      });
      // Stop when fully done or stuck
      if (rate >= stuckCap) {
        if (interval) clearInterval(interval);
      }
    }, updateInterval);
  }, joinDelay);

  return {
    stop() {
      if (joinTimeout) clearTimeout(joinTimeout);
      if (interval) clearInterval(interval);
    },
  };
}
