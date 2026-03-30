import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/store/AppContext';
import { allFrames } from '@/pages/AvatarEdit';
import { Users, Copy, Check, UserPlus, X, Loader2 } from 'lucide-react';
import { createTeam } from '@/services/teamService';
import { createSimulatedTeammate, startTeammateSimulation, type SimulationHandle } from '@/services/teamSimulator';

export default function TeamPanel() {
  const { state, dispatch } = useApp();
  const team = state.team;
  const [inviteInput, setInviteInput] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const simRef = useRef<SimulationHandle | null>(null);

  // Start simulation when team becomes active with a simulated member
  useEffect(() => {
    if (team?.status === 'active' && team.members.some(m => m.isSimulated)) {
      simRef.current = startTeammateSimulation(
        (progress) => {
          dispatch({ type: 'UPDATE_TEAMMATE_PROGRESS', payload: progress });
        },
      );
    }
    return () => { simRef.current?.stop(); };
  }, [team?.status, team?.id, dispatch]);

  // Update self progress in team whenever task completion changes
  const { getTaskCompletionRate } = useApp();
  const { rate } = getTaskCompletionRate();
  useEffect(() => {
    if (team?.status === 'active') {
      dispatch({
        type: 'SET_TEAM',
        payload: {
          ...team,
          members: team.members.map(m =>
            !m.isSimulated
              ? { ...m, progress: { ...m.progress, taskCompletionRate: rate, isReady: rate >= 0.8, lastUpdated: new Date().toISOString() } }
              : m
          ),
        },
      });
    }
  // Only react to rate changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate]);

  const handleCreateTeam = async () => {
    if (!state.user) return;
    setLoading(true);
    const newTeam = await createTeam(state.user.id, state.user.nickname, state.user.avatar);
    dispatch({ type: 'SET_TEAM', payload: newTeam });
    setLoading(false);

    // Simulate teammate joining after delay
    setTimeout(() => {
      const teammate = createSimulatedTeammate();
      dispatch({
        type: 'SET_TEAM',
        payload: {
          ...newTeam,
          status: 'active',
          members: [...newTeam.members, teammate],
        },
      });
    }, 3000 + Math.random() * 5000);
  };

  const handleJoinTeam = () => {
    if (!state.user || !inviteInput.trim()) return;
    // MVP: simulate joining - create team with self + simulated partner
    const teammate = createSimulatedTeammate();
    const selfMember = {
      id: state.user.id,
      name: state.user.nickname,
      avatar: state.user.avatar,
      isSimulated: false,
      progress: { taskCompletionRate: rate, studyMinutes: 0, isReady: rate >= 0.8, lastUpdated: new Date().toISOString() },
    };
    dispatch({
      type: 'SET_TEAM',
      payload: {
        id: `team-${Date.now()}`,
        inviteCode: inviteInput.trim().toUpperCase(),
        members: [selfMember, teammate],
        status: 'active',
        createdAt: new Date().toISOString(),
        todayCheckedIn: false,
      },
    });
    setShowJoinInput(false);
    setInviteInput('');
  };

  const handleCopyCode = () => {
    if (team?.inviteCode) {
      navigator.clipboard.writeText(team.inviteCode).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDissolve = () => {
    simRef.current?.stop();
    dispatch({ type: 'DISSOLVE_TEAM' });
  };

  // Render: no team
  if (!team) {
    return (
      <div className="mx-4 mt-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Users size={14} className="text-primary" />
          组队学习
        </h3>
        <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
          <p className="text-xs text-text-muted mb-3 text-center">和好友一起完成学习任务，组队打卡奖励更丰富!</p>
          {showJoinInput ? (
            <div className="flex gap-2">
              <input
                value={inviteInput}
                onChange={e => setInviteInput(e.target.value.toUpperCase())}
                placeholder="输入6位邀请码"
                maxLength={6}
                className="flex-1 border border-border rounded-xl px-3 py-2 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button onClick={handleJoinTeam} disabled={inviteInput.length < 6} className="bg-primary text-white px-4 rounded-xl text-sm disabled:opacity-50">
                加入
              </button>
              <button onClick={() => { setShowJoinInput(false); setInviteInput(''); }} className="p-2 text-text-muted">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleCreateTeam}
                disabled={loading}
                className="bg-primary text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 active:opacity-80 disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                创建队伍
              </button>
              <button
                onClick={() => setShowJoinInput(true)}
                className="bg-white text-primary border-2 border-primary py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 active:opacity-80"
              >
                <UserPlus size={14} />
                加入队伍
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render: waiting for teammate
  if (team.status === 'waiting') {
    return (
      <div className="mx-4 mt-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Users size={14} className="text-primary" />
          组队学习
        </h3>
        <div className="bg-white rounded-2xl p-4 border border-border shadow-sm text-center">
          <p className="text-xs text-text-muted mb-3">分享邀请码给好友</p>
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-2xl font-mono font-bold tracking-[0.3em] text-primary">
              {team.inviteCode}
            </span>
            <button onClick={handleCopyCode} className="p-1.5 rounded-lg bg-gray-100 active:bg-gray-200">
              {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} className="text-text-muted" />}
            </button>
          </div>
          <div className="flex items-center justify-center gap-2 text-text-muted text-xs">
            <Loader2 size={12} className="animate-spin" />
            等待队友加入...
          </div>
          <button onClick={handleDissolve} className="mt-3 text-xs text-danger">解散队伍</button>
        </div>
      </div>
    );
  }

  // Render: active team with progress
  const self = team.members.find(m => !m.isSimulated);
  const partner = team.members.find(m => m.isSimulated);
  const bothReady = team.members.every(m => m.progress.isReady);

  return (
    <div className="mx-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Users size={14} className="text-primary" />
          组队学习
        </h3>
        <button onClick={handleDissolve} className="text-[10px] text-text-muted">解散</button>
      </div>
      <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
        <div className="flex items-center justify-around gap-4">
          {/* Self */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="relative">
              {state.user?.avatarFrame ? (
                (() => {
                  const frameConfig = allFrames.find(f => f.icon === state.user!.avatarFrame);
                  if (!frameConfig) return null;
                  const isCustomAvatar = state.user?.avatar?.startsWith('data:') || state.user?.avatar?.startsWith('http');
                  return (
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center ${frameConfig.animation ? 'animate-gradient-shift' : ''}`}
                      style={{
                        background: frameConfig.gradient,
                        clipPath: frameConfig.shapeTransform || 'circle(50%)',
                        backgroundSize: frameConfig.animation ? '200% 200%' : '100% 100%',
                      }}
                    >
                      <div className={`bg-white/20 rounded-full flex items-center justify-center p-1 w-[calc(100%-6px)] h-[calc(100%-6px)] border-3 ${
                        self?.progress.isReady ? 'border-accent' : 'border-white/50'
                      }`}>
                        {isCustomAvatar ? (
                          <img src={state.user.avatar} alt="头像" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <span className="text-2xl">{state.user?.avatar || '👤'}</span>
                        )}
                      </div>
                      {frameConfig.decorations && frameConfig.decorations.length > 0 && (
                        <div className="absolute inset-0 pointer-events-none">
                          {frameConfig.decorations.map((dec, i) => (
                            <span
                              key={i}
                              className={`absolute text-sm ${frameConfig.animation ? 'animate-bounce' : ''}`}
                              style={{
                                top: i === 0 ? '-4px' : i === 1 ? '50%' : 'auto',
                                bottom: i === 2 ? '-4px' : 'auto',
                                right: i === 1 ? '-4px' : i === 2 ? '0' : 'auto',
                                left: i === 0 ? '50%' : i === 1 ? 'auto' : '0',
                                transform: i === 0 ? 'translateX(-50%)' : i === 1 ? 'translateY(-50%)' : 'none',
                                animationDelay: `${i * 0.5}s`,
                              }}
                            >
                              {dec}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl border-3 ${
                  self?.progress.isReady ? 'border-accent bg-accent/10' : 'border-gray-200 bg-gray-50'
                }`}>
                  {state.user?.avatar || '👤'}
                </div>
              )}
              {self?.progress.isReady && (
                <div className="absolute -bottom-0.5 -right-0.5 bg-accent text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">
                  ✓
                </div>
              )}
            </div>
            <span className="text-xs font-medium truncate max-w-[60px]">{state.user?.nickname || '我'}</span>
            <span className="text-[10px] text-text-muted">{Math.round((self?.progress.taskCompletionRate ?? 0) * 100)}%</span>
          </div>

          {/* Connection */}
          <div className={`text-xl ${bothReady ? 'text-accent' : 'text-gray-300'}`}>🤝</div>

          {/* Partner */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="relative">
              {partner?.avatarFrame ? (
                (() => {
                  const frameConfig = allFrames.find(f => f.icon === partner.avatarFrame);
                  if (!frameConfig) return null;
                  const isCustomAvatar = partner.avatar?.startsWith('data:') || partner.avatar?.startsWith('http');
                  return (
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center ${frameConfig.animation ? 'animate-gradient-shift' : ''}`}
                      style={{
                        background: frameConfig.gradient,
                        clipPath: frameConfig.shapeTransform || 'circle(50%)',
                        backgroundSize: frameConfig.animation ? '200% 200%' : '100% 100%',
                      }}
                    >
                      <div className={`bg-white/20 rounded-full flex items-center justify-center p-1 w-[calc(100%-6px)] h-[calc(100%-6px)] border-3 ${
                        partner?.progress.isReady ? 'border-accent' : 'border-white/50'
                      }`}>
                        {isCustomAvatar ? (
                          <img src={partner.avatar} alt="头像" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <span className="text-2xl">{partner.avatar || '👤'}</span>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl border-3 ${
                  partner?.progress.isReady ? 'border-accent bg-accent/10' : 'border-gray-200 bg-gray-50'
                }`}>
                  {partner?.avatar || '👤'}
                </div>
              )}
              {partner?.progress.isReady && (
                <div className="absolute -bottom-0.5 -right-0.5 bg-accent text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">
                  ✓
                </div>
              )}
            </div>
            <span className="text-xs font-medium truncate max-w-[60px]">{partner?.name || '队友'}</span>
            <span className="text-[10px] text-text-muted">{Math.round((partner?.progress.taskCompletionRate ?? 0) * 100)}%</span>
          </div>
        </div>

        {/* Status message */}
        <div className="mt-3 text-center">
          {bothReady ? (
            <span className="text-xs text-accent font-medium">双方均已完成，可以组队签到了!</span>
          ) : (
            <span className="text-xs text-text-muted">
              {!self?.progress.isReady && !partner?.progress.isReady
                ? '双方都还在学习中...'
                : !self?.progress.isReady
                  ? '你还需要继续完成任务'
                  : '等待队友完成任务...'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
