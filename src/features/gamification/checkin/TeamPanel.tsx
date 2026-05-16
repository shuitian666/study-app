import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, Sparkles, Trophy, UserPlus, Users, X } from 'lucide-react';
import { useGame } from '@/store/GameContext';
import { useLearning } from '@/store/LearningContext';
import { useUser } from '@/store/UserContext';
import { createTeam } from '@/services/teamService';
import { createSimulatedTeammate, startTeammateSimulation, type SimulationHandle } from '@/services/teamSimulator';
import { getLocalDateKey } from '@/utils/experience';

interface TeamPanelProps {
  onClose?: () => void;
}

export default function TeamPanel({ onClose }: TeamPanelProps) {
  const { userState, navigate } = useUser();
  const { getTaskCompletionRate } = useLearning();
  const { gameState, gameDispatch } = useGame();
  const team = gameState.team;
  const today = getLocalDateKey();
  const todayRecord = gameState.checkin.records.find(record => record.date === today);
  const [inviteInput, setInviteInput] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const simRef = useRef<SimulationHandle | null>(null);
  const joinTimerRef = useRef<number | null>(null);

  const { rate } = getTaskCompletionRate();
  const bothReady = team?.status === 'active' && team.members.every(member => member.progress.isReady);
  const hasSimulatedMember = team?.members.some(member => member.isSimulated) ?? false;
  const canUpgrade =
    !!team &&
    team.status === 'active' &&
    bothReady &&
    !!todayRecord &&
    todayRecord.type !== 'team' &&
    !team.todayCheckedIn;

  useEffect(() => {
    return () => {
      simRef.current?.stop();
      if (joinTimerRef.current) window.clearTimeout(joinTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (team?.status !== 'active' || !hasSimulatedMember) return;
    simRef.current?.stop();
    simRef.current = startTeammateSimulation(progress => {
      gameDispatch({ type: 'UPDATE_TEAMMATE_PROGRESS', payload: progress });
    });
    return () => simRef.current?.stop();
  }, [team?.id, team?.status, hasSimulatedMember, gameDispatch]);

  useEffect(() => {
    if (team?.status !== 'active') return;
    const nextReady = rate >= 0.8;
    const nextRate = Math.round(rate * 100) / 100;
    const self = team.members.find(member => !member.isSimulated);
    if (!self) return;
    if (self.progress.taskCompletionRate === nextRate && self.progress.isReady === nextReady) return;

    gameDispatch({
      type: 'SET_TEAM',
      payload: {
        ...team,
        members: team.members.map(member =>
          member.isSimulated
            ? member
            : {
                ...member,
                progress: {
                  ...member.progress,
                  taskCompletionRate: nextRate,
                  isReady: nextReady,
                  lastUpdated: new Date().toISOString(),
                },
              }
        ),
      },
    });
  }, [rate, team, gameDispatch]);

  const handleCreateTeam = async () => {
    if (!userState.user || loading) return;
    setLoading(true);
    const newTeam = await createTeam(userState.user.id, userState.user.nickname, userState.user.avatar);
    gameDispatch({ type: 'SET_TEAM', payload: newTeam });
    setLoading(false);

    joinTimerRef.current = window.setTimeout(() => {
      const teammate = createSimulatedTeammate();
      gameDispatch({
        type: 'SET_TEAM',
        payload: {
          ...newTeam,
          status: 'active',
          members: [...newTeam.members, teammate],
        },
      });
    }, 1800);
  };

  const handleJoinTeam = () => {
    if (!userState.user || inviteInput.trim().length < 6) return;
    const teammate = createSimulatedTeammate();
    gameDispatch({
      type: 'SET_TEAM',
      payload: {
        id: `team-${Date.now()}`,
        inviteCode: inviteInput.trim().toUpperCase(),
        status: 'active',
        createdAt: new Date().toISOString(),
        todayCheckedIn: false,
        members: [
          {
            id: userState.user.id,
            name: userState.user.nickname,
            avatar: userState.user.avatar,
            isSimulated: false,
            progress: {
              taskCompletionRate: Math.round(rate * 100) / 100,
              studyMinutes: 0,
              isReady: rate >= 0.8,
              lastUpdated: new Date().toISOString(),
            },
          },
          teammate,
        ],
      },
    });
    setInviteInput('');
    setShowJoinInput(false);
  };

  const handleCopyCode = () => {
    if (!team?.inviteCode) return;
    navigator.clipboard.writeText(team.inviteCode).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleDissolve = () => {
    simRef.current?.stop();
    if (joinTimerRef.current) window.clearTimeout(joinTimerRef.current);
    gameDispatch({ type: 'DISSOLVE_TEAM' });
  };

  const handleUpgrade = () => {
    if (!team || !canUpgrade) return;
    gameDispatch({ type: 'UPGRADE_TODAY_CHECKIN_TO_TEAM', payload: { date: today, teamId: team.id } });
  };

  const renderProgress = (value: number) => `${Math.round(value * 100)}%`;

  return (
    <div className="bg-white w-full max-w-sm shadow-2xl border border-border p-5" style={{ borderRadius: 24 }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users size={20} className="text-primary" />
            <h2 className="text-lg font-bold text-text-primary">组队学习</h2>
          </div>
          <p className="mt-1 text-xs text-text-muted">和队友互相督促，双方达标后可升级今日签到奖励。</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 rounded-full bg-gray-100 text-text-muted active:opacity-70" aria-label="关闭组队面板">
            <X size={16} />
          </button>
        )}
      </div>

      {!team && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCreateTeam}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />}
              创建小队
            </button>
            <button
              onClick={() => setShowJoinInput(true)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-primary bg-white py-3 text-sm font-semibold text-primary"
            >
              <UserPlus size={15} />
              加入小队
            </button>
          </div>

          {showJoinInput && (
            <div className="flex gap-2">
              <input
                value={inviteInput}
                onChange={event => setInviteInput(event.target.value.toUpperCase())}
                maxLength={6}
                placeholder="输入邀请码"
                className="min-w-0 flex-1 rounded-xl border border-border px-3 py-2 text-center text-sm font-mono tracking-widest outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button onClick={handleJoinTeam} disabled={inviteInput.length < 6} className="rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">
                加入
              </button>
            </div>
          )}
        </div>
      )}

      {team?.status === 'waiting' && (
        <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-center">
          <p className="text-xs text-text-muted">分享邀请码给好友</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="font-mono text-2xl font-bold tracking-[0.28em] text-primary">{team.inviteCode}</span>
            <button onClick={handleCopyCode} className="rounded-lg bg-white p-2 shadow-sm">
              {copied ? <Check size={15} className="text-accent" /> : <Copy size={15} className="text-text-muted" />}
            </button>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-text-muted">
            <Loader2 size={13} className="animate-spin" />
            等待队友加入...
          </div>
          <button onClick={handleDissolve} className="mt-4 text-xs text-danger">解散小队</button>
        </div>
      )}

      {team?.status === 'active' && (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl bg-gray-50 p-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              {team.members.slice(0, 2).map((member, index) => (
                <div key={member.id} className="flex flex-col items-center gap-2">
                  <div className={`relative flex h-14 w-14 items-center justify-center rounded-full border-2 text-2xl ${member.progress.isReady ? 'border-accent bg-accent/10' : 'border-gray-200 bg-white'}`}>
                    {member.avatar || (index === 0 ? '我' : '友')}
                    {member.progress.isReady && (
                      <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] text-white">✓</span>
                    )}
                  </div>
                  <div className="max-w-[84px] truncate text-xs font-semibold text-text-primary">{member.isSimulated ? member.name : '我'}</div>
                  <div className="text-[11px] text-text-muted">{renderProgress(member.progress.taskCompletionRate)}</div>
                </div>
              ))}
              <div className={`flex h-9 w-9 items-center justify-center rounded-full ${bothReady ? 'bg-accent/10 text-accent' : 'bg-white text-text-muted'}`}>
                <Sparkles size={17} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-primary" />
              <span className="text-sm font-semibold text-text-primary">今日组队奖励</span>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {team.todayCheckedIn || todayRecord?.type === 'team'
                ? '今日组队奖励已领取。'
                : canUpgrade
                  ? '双方已达标，可将今日普通签到升级为组队签到，补领 1 次常规抽签。'
                  : todayRecord
                    ? '等待双方学习进度达标后，可补领组队额外奖励。'
                    : '先完成今日学习目标并签到，再回来升级组队奖励。'}
            </p>
            {canUpgrade ? (
              <button onClick={handleUpgrade} className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white active:opacity-80">
                升级为组队签到
              </button>
            ) : !todayRecord ? (
              <button onClick={() => { onClose?.(); navigate('checkin'); }} className="mt-3 w-full rounded-xl bg-gray-100 py-3 text-sm font-semibold text-text-primary active:opacity-80">
                去签到
              </button>
            ) : null}
          </div>

          <button onClick={handleDissolve} className="w-full rounded-xl py-2.5 text-xs font-medium text-text-muted active:bg-gray-50">
            解散小队
          </button>
        </div>
      )}
    </div>
  );
}
