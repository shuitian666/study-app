import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Loader2, RefreshCw, ShieldCheck, Sparkles, Ticket, Trophy, UserPlus, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/Common';
import { useGame } from '@/store/GameContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { useUser } from '@/store/UserContext';
import { createTeam, dissolveTeam, joinTeamByCode, pollTeamStatus, updateTeamProgress } from '@/services/teamService';
import { getTodayLearningProgress } from '@/utils/dailyLearningProgress';
import { getLocalDateKey } from '@/utils/experience';

const MINUTES_PER_LEARNING_ITEM = 3;

function formatPercent(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

export default function TeamPage() {
  const { userState, navigate } = useUser();
  const { learningState } = useLearning();
  const { gameState, gameDispatch } = useGame();
  const { theme } = useTheme();
  const user = userState.user;
  const team = gameState.team;
  const today = getLocalDateKey();
  const todayRecord = gameState.checkin.records.find(record => record.date === today);
  const teamId = team?.id;
  const teamStatus = team?.status;
  const [inviteInput, setInviteInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<'create' | 'join' | 'dissolve' | null>(null);
  const [error, setError] = useState('');
  const progressSignatureRef = useRef('');
  const todayLearningCount = useMemo(() => getTodayLearningProgress(learningState).totalCount, [learningState]);
  const dailyGoal = Math.max(1, user?.dailyGoal ?? 10);
  const goalProgressRate = Math.min(todayLearningCount / dailyGoal, 1);
  const estimatedStudyMinutes = todayLearningCount * MINUTES_PER_LEARNING_ITEM;
  const selfProgress = useMemo(() => ({
    taskCompletionRate: Math.round(goalProgressRate * 100) / 100,
    studyMinutes: estimatedStudyMinutes,
    isReady: todayLearningCount >= dailyGoal,
  }), [dailyGoal, estimatedStudyMinutes, goalProgressRate, todayLearningCount]);
  const bothReady = team?.status === 'active' && team.members.length >= 2 && team.members.every(member => member.progress.isReady);
  const canUpgrade = Boolean(
    team &&
    team.status === 'active' &&
    bothReady &&
    todayRecord &&
    todayRecord.type !== 'team' &&
    !team.todayCheckedIn
  );
  const waitingForCheckin = team?.status === 'active' && bothReady && !todayRecord;
  const rewardClaimed = Boolean(team?.todayCheckedIn || todayRecord?.type === 'team');
  const activeMembers = team?.members.slice(0, 2) ?? [];

  useEffect(() => {
    if (!teamId || teamStatus === 'dissolved') return;
    return pollTeamStatus(teamId, nextTeam => {
      gameDispatch({ type: 'SET_TEAM', payload: nextTeam });
    }, 3000);
  }, [gameDispatch, teamId, teamStatus]);

  useEffect(() => {
    if (!team || team.status === 'dissolved' || !user) return;
    const signature = `${team.id}:${user.id}:${selfProgress.taskCompletionRate}:${selfProgress.studyMinutes}:${selfProgress.isReady}`;
    if (progressSignatureRef.current === signature) return;
    progressSignatureRef.current = signature;
    updateTeamProgress(team.id, user.id, selfProgress)
      .then(nextTeam => gameDispatch({ type: 'SET_TEAM', payload: nextTeam }))
      .catch(err => {
        console.warn('Failed to update team progress:', err);
      });
  }, [gameDispatch, selfProgress, team, user]);

  const handleCreate = async () => {
    if (!user || busy) return;
    setBusy('create');
    setError('');
    try {
      gameDispatch({ type: 'SET_TEAM', payload: await createTeam(user.id, user.nickname, user.avatar) });
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建小队失败');
    } finally {
      setBusy(null);
    }
  };

  const handleJoin = async () => {
    const code = inviteInput.trim().toUpperCase();
    if (!user || code.length < 6 || busy) return;
    setBusy('join');
    setError('');
    try {
      gameDispatch({ type: 'SET_TEAM', payload: await joinTeamByCode(code, user.id, user.nickname, user.avatar) });
      setInviteInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加入小队失败');
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = () => {
    if (!team?.inviteCode) return;
    navigator.clipboard.writeText(team.inviteCode).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleDissolve = async () => {
    if (!team || busy) return;
    setBusy('dissolve');
    setError('');
    try {
      await dissolveTeam(team.id);
    } catch (err) {
      console.warn('Failed to dissolve team on server:', err);
    } finally {
      gameDispatch({ type: 'DISSOLVE_TEAM' });
      setBusy(null);
    }
  };

  const handleUpgrade = () => {
    if (!team || !canUpgrade) return;
    gameDispatch({ type: 'UPGRADE_TODAY_CHECKIN_TO_TEAM', payload: { date: today, teamId: team.id } });
  };

  const heroTone = bothReady ? 'from-emerald-500 to-teal-500' : 'from-indigo-500 to-sky-500';

  return (
    <div className="page-scroll min-h-full pb-24" style={{ backgroundColor: theme.bg || '#f8fafc' }}>
      <PageHeader title="学习小队" onBack={() => navigate('home')} />

      <div className="px-4 pt-3">
        <section className={`rounded-[28px] bg-gradient-to-br ${heroTone} p-5 text-white shadow-[0_22px_48px_-30px_rgba(15,23,42,0.7)]`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-white/80">
                <Users size={16} />
                <span>{team ? (team.status === 'active' ? '双人小队进行中' : '等待队友加入') : '组队学习'}</span>
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-normal">
                {bothReady ? '双方今日都达标了' : team ? '和队友同步今天的进度' : '找个队友一起完成目标'}
              </h1>
              <p className="mt-2 max-w-[17rem] text-sm leading-6 text-white/78">
                组队奖励为每日额外 1 次常规抽签。双方进度达标后，可把今日普通签到升级为组队签到。
              </p>
            </div>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-white/18">
              <ShieldCheck size={34} />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Metric label="今日学习" value={`${todayLearningCount}/${dailyGoal}`} />
            <Metric label="估算时长" value={`${estimatedStudyMinutes}m`} />
            <Metric label="奖励" value="+1抽" />
          </div>
        </section>

        {error && (
          <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        {!team && (
          <section className="mt-4 rounded-[24px] border border-border bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleCreate}
                disabled={busy !== null}
                className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-primary px-3 py-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy === 'create' ? <Loader2 size={22} className="animate-spin" /> : <Users size={22} />}
                创建小队
              </button>
              <div className="rounded-2xl border border-border bg-gray-50 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                  <UserPlus size={14} />
                  加入小队
                </div>
                <input
                  value={inviteInput}
                  onChange={event => setInviteInput(event.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="邀请码"
                  className="h-10 w-full rounded-xl border border-border bg-white px-3 text-center font-mono text-sm tracking-[0.22em] outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={handleJoin}
                  disabled={busy !== null || inviteInput.trim().length < 6}
                  className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-white text-sm font-semibold text-primary disabled:opacity-45"
                >
                  {busy === 'join' && <Loader2 size={14} className="animate-spin" />}
                  加入
                </button>
              </div>
            </div>
          </section>
        )}

        {team?.status === 'waiting' && (
          <section className="mt-4 rounded-[24px] border border-border bg-white p-5 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <RefreshCw size={24} className="animate-spin" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-text-primary">等待队友加入</h2>
            <p className="mt-1 text-sm text-text-muted">把邀请码发给队友，加入后会自动开始同步进度。</p>
            <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-gray-50 px-4 py-3">
              <span className="font-mono text-2xl font-bold tracking-[0.28em] text-primary">{team.inviteCode}</span>
              <button onClick={handleCopy} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm">
                {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} className="text-text-muted" />}
              </button>
            </div>
            <button onClick={handleDissolve} disabled={busy !== null} className="mt-4 text-sm font-medium text-text-muted disabled:opacity-50">
              解散小队
            </button>
          </section>
        )}

        {team?.status === 'active' && (
          <>
            <section className="mt-4 rounded-[24px] border border-border bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-text-primary">今日同步</h2>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${bothReady ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-text-muted'}`}>
                  {bothReady ? '双方达标' : '同步中'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {activeMembers.map(member => (
                  <div key={member.id} className="rounded-2xl bg-gray-50 p-3">
                    <div className="flex items-center gap-3">
                      <TeamAvatar
                        avatar={member.avatar}
                        avatarFrame={member.avatarFrame}
                        ready={member.progress.isReady}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-text-primary">{member.id === user?.id ? '我' : member.name}</div>
                        <div className="text-xs text-text-muted">{member.progress.studyMinutes} 分钟</div>
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: formatPercent(member.progress.taskCompletionRate) }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                      <span>{formatPercent(member.progress.taskCompletionRate)}</span>
                      <span>{member.progress.isReady ? '已达标' : '未达标'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-4 rounded-[24px] border border-border bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <Trophy size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-text-primary">今日组队奖励</h2>
                  <p className="mt-1 text-sm leading-6 text-text-muted">
                    {rewardClaimed
                      ? '今日组队奖励已领取。'
                      : canUpgrade
                        ? '双方已达标，可补领 1 次常规抽签。'
                        : waitingForCheckin
                          ? '双方已达标，先完成今日签到后回来领取额外奖励。'
                          : '双方都完成 80% 今日任务后，可领取额外奖励。'}
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">
                  <Ticket size={13} />
                  +1
                </div>
              </div>

              {canUpgrade ? (
                <button onClick={handleUpgrade} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-white active:opacity-85">
                  <Sparkles size={17} />
                  领取组队奖励
                </button>
              ) : waitingForCheckin || !todayRecord ? (
                <button onClick={() => navigate('checkin')} className="mt-4 h-12 w-full rounded-2xl bg-gray-100 text-sm font-semibold text-text-primary active:opacity-85">
                  去签到
                </button>
              ) : null}
            </section>

            <button onClick={handleDissolve} disabled={busy !== null} className="mt-4 h-11 w-full rounded-2xl text-sm font-medium text-text-muted active:bg-gray-100 disabled:opacity-50">
              {busy === 'dissolve' ? '正在解散...' : '解散小队'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/16 px-3 py-2">
      <div className="text-[11px] text-white/70">{label}</div>
      <div className="mt-0.5 text-sm font-bold">{value}</div>
    </div>
  );
}

function TeamAvatar({ avatar, avatarFrame, ready }: { avatar?: string; avatarFrame?: string; ready: boolean }) {
  const isImageAvatar = Boolean(avatar?.startsWith('data:') || avatar?.startsWith('http'));

  return (
    <div
      className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-xl ${
        ready ? 'bg-emerald-100 ring-2 ring-emerald-400' : 'bg-white'
      }`}
    >
      {isImageAvatar && avatar ? (
        <img src={avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{avatar || '👤'}</span>
      )}
      {avatarFrame && (
        <span className="pointer-events-none absolute -right-1 -top-1 text-sm drop-shadow-sm">
          {avatarFrame}
        </span>
      )}
    </div>
  );
}
