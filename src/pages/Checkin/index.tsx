import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/ui/Common';
import { Calendar, Gift, Ticket, Flame, BookOpen, CheckCircle, AlertCircle, Sparkles, Gift as GiftIcon, X, Copy, Check } from 'lucide-react';
import { STREAK_REWARDS } from '@/data/incentive-mock';
import TeamPanel from './TeamPanel';

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

// 兑换码配置
const REDEMPTION_CODES: Record<string, { upDraws: number; regularDraws: number; coins: number }> = {
  '学习使我快乐': { upDraws: 10, regularDraws: 0, coins: 0 },
  '勤奋好学': { upDraws: 5, regularDraws: 0, coins: 0 },
};

export default function CheckinPage() {
  const { state, dispatch, navigate } = useApp();
  const { checkin, team, drawBalance, lastCheckinReward, redeemedCodes, quizResults } = state;
  const today = getToday();
  const todayChecked = checkin.records.some(r => r.date === today);

  // 计算今日答题数量
  const todayResults = quizResults.filter(r => 
    new Date(r.completedAt).toDateString() === today
  );
  const todayQuestions = todayResults.reduce((sum, r) => sum + r.totalQuestions, 0);
  
  // 学习目标
  const dailyGoal = state.user?.dailyGoal ?? 10;
  const goalProgress = Math.min((todayQuestions / dailyGoal) * 100, 100);
  const goalAchieved = todayQuestions >= dailyGoal;

  // 签到条件：达成学习目标即可签到
  const canCheckin = goalAchieved && !todayChecked;

  const last7 = getLast7Days();

  // 兑换码相关
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemInput, setRedeemInput] = useState('');
  const [redeemMessage, setRedeemMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleRedeemCode = () => {
    if (!redeemInput.trim()) return;
    const code = redeemInput.trim();
    if (redeemedCodes.includes(code)) {
      setRedeemMessage({ type: 'error', text: '该兑换码已使用' });
      return;
    }
    const reward = REDEMPTION_CODES[code];
    if (!reward) {
      setRedeemMessage({ type: 'error', text: '无效的兑换码' });
      return;
    }
    dispatch({ type: 'REDEEM_CODE', payload: code });
    setRedeemMessage({ type: 'success', text: `兑换成功！获得UP抽数+${reward.upDraws}` });
    setRedeemInput('');
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText('学习使我快乐').catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Team check
  const hasActiveTeam = team?.status === 'active';
  const bothReady = hasActiveTeam && team!.members.every(m => m.progress.isReady);

  const performCheckin = (type: 'normal' | 'team') => {
    if (!canCheckin) return;
    dispatch({
      type: 'CHECKIN',
      payload: { date: today, type, teamId: type === 'team' ? team?.id : undefined },
    });
  };

  const handleMakeup = (date: string) => {
    if (checkin.makeupCards <= 0) return;
    dispatch({ type: 'CHECKIN', payload: { date, type: 'makeup' } });
  };

  return (
    <div className="page-scroll pb-4">
      <PageHeader title="每日签到" onBack={() => navigate('home')} />

      {/* Streak header */}
      <div className="bg-gradient-to-br from-secondary to-orange-500 text-white mx-4 mt-3 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Flame size={18} />
              <span className="text-lg font-bold">连续签到 {checkin.streak} 天</span>
            </div>

            <p className="text-white/70 text-xs">累计签到 {checkin.totalCheckins} 天</p>
          </div>

          <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
            <Ticket size={14} />
            <span className="text-sm">补签卡 x{checkin.makeupCards}</span>
          </div>

        </div>


        {/* Checkin button(s) */}
        {todayChecked ? (
          <div className="w-full py-3 rounded-xl bg-white/20 text-white/60 text-center text-sm font-medium">
            今日已签到 ✓
          </div>

        ) : !canCheckin ? (
          <div className="w-full py-3 rounded-xl bg-white/10 text-white/50 text-center text-sm cursor-default">
            完成学习任务后可签到
          </div>

        ) : hasActiveTeam && bothReady ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => performCheckin('normal')}
              className="py-3 rounded-xl bg-white/30 text-white text-sm font-medium active:scale-[0.97] transition-transform"
            >
              独立签到
            </button>

            <button
              onClick={() => performCheckin('team')}
              className="py-3 rounded-xl bg-white text-orange-600 shadow-lg text-sm font-medium active:scale-[0.97] transition-transform"
            >
              组队签到
            </button>

          </div>

        ) : (
          <button
            onClick={() => performCheckin('normal')}
            className="w-full py-3 rounded-xl bg-white text-orange-600 shadow-lg font-medium text-sm active:scale-[0.97] transition-transform"
          >
            立即签到
          </button>

        )}
      </div>


      {/* Checkin reward notification */}
      {lastCheckinReward && (lastCheckinReward.regularTickets > 0 || lastCheckinReward.upTickets > 0 || lastCheckinReward.streakCoins > 0) && (
        <div className="mx-4 mt-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-200/60">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-semibold text-amber-800 mb-2">签到奖励</h4>
              <div className="flex flex-wrap gap-2">
                {lastCheckinReward.regularTickets > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                    🎋 常规抽签 +{lastCheckinReward.regularTickets}
                  </span>
                )}
                {lastCheckinReward.upTickets > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full">
                    ✨ UP池抽签 +{lastCheckinReward.upTickets}
                  </span>
                )}
                {lastCheckinReward.streakCoins > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
                    ⭐ 星币 +{lastCheckinReward.streakCoins}
                  </span>
                )}
              </div>

              {lastCheckinReward.streakLabel && (
                <p className="text-[10px] text-amber-600 mt-1.5">连续签到 {lastCheckinReward.streakLabel} 里程碑奖励!</p>
              )}
            </div>

            <button
              onClick={() => dispatch({ type: 'DISMISS_CHECKIN_REWARD' })}
              className="text-amber-400 text-xs px-1"
            >
              ✕
            </button>

          </div>

        </div>

      )}


      {/* Draw balance card - link to lottery */}
      <div
        className="mx-4 mt-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-4 active:opacity-90 transition-opacity cursor-pointer"
        onClick={() => navigate('lottery')}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>

            <div>
              <h4 className="text-white font-semibold text-sm">我的抽签</h4>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-white/80 text-xs">常规 {drawBalance.regular} 次</span>
                <span className="text-white/80 text-xs">UP池 {drawBalance.up} 次</span>
              </div>

            </div>

          </div>

          <span className="text-white/60 text-xs">去抽签 &gt;</span>
        </div>

      </div>


      {/* 兑换码入口 */}
      <div className="mx-4 mt-3">
        <button
          onClick={() => setShowRedeemModal(true)}
          className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-2xl p-4 flex items-center justify-between active:opacity-90 transition-opacity"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <GiftIcon size={20} className="text-white" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-sm">兑换码</div>
              <div className="text-white/80 text-xs">输入兑换码获得奖励</div>
            </div>
          </div>
          <span className="text-white/60 text-xs">兑换 &gt;</span>
        </button>
      </div>

      {/* 兑换码弹窗 */}
      {showRedeemModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => { setShowRedeemModal(false); setRedeemMessage(null); }}>
          <div className="bg-white w-full max-w-md rounded-t-3xl p-5 pb-8 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">兑换码</h3>
              <button onClick={() => { setShowRedeemModal(false); setRedeemMessage(null); }} className="p-1 text-text-muted">
                <X size={20} />
              </button>
            </div>

            {/* 示例兑换码 */}
            <div className="bg-amber-50 rounded-xl p-3 mb-4 border border-amber-200">
              <div className="text-xs text-amber-700 mb-1.5">示例兑换码</div>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-amber-900">学习使我快乐</span>
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 bg-amber-200 rounded-lg text-amber-700 active:bg-amber-300 transition-colors"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <div className="text-[10px] text-amber-600 mt-1">可获得UP抽数 +10</div>
            </div>

            {/* 输入框 */}
            <div className="mb-3">
              <input
                type="text"
                value={redeemInput}
                onChange={(e) => { setRedeemInput(e.target.value); setRedeemMessage(null); }}
                placeholder="输入兑换码"
                className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* 消息提示 */}
            {redeemMessage && (
              <div className={`mb-3 p-3 rounded-xl text-sm ${redeemMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {redeemMessage.text}
              </div>
            )}

            {/* 确认按钮 */}
            <button
              onClick={handleRedeemCode}
              disabled={!redeemInput.trim()}
              className="w-full bg-primary text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50 active:opacity-80 transition-opacity"
            >
              确认兑换
            </button>
          </div>
        </div>
      )}


      {/* Today's learning goal progress */}
      <div className="mx-4 mt-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <BookOpen size={14} className="text-primary" />
          今日学习目标
        </h3>

        <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-muted">
              已完成 {todayQuestions} / {dailyGoal} 题
            </span>
            {goalAchieved ? (
              <span className="flex items-center gap-1 text-xs text-accent font-medium">
                <CheckCircle size={12} /> 已满足签到条件
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-secondary font-medium">
                <AlertCircle size={12} /> 需完成 {dailyGoal} 题
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.round(goalProgress))}%`,
                backgroundColor: goalAchieved ? '#10b981' : '#f59e0b',
              }}
            />
          </div>

          {!goalAchieved && (
            <p className="text-[10px] text-text-muted mt-2">
              再完成 {dailyGoal - todayQuestions} 题即可签到
            </p>
          )}
          
          {goalAchieved && (
            <p className="text-[10px] text-accent mt-2 font-medium">
              恭喜！已完成今日学习目标，快去签到领奖励吧！
            </p>
          )}
        </div>

      </div>


      {/* Team panel */}
      <TeamPanel />

      {/* 7-day calendar */}
      <div className="mx-4 mt-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Calendar size={14} className="text-primary" />
          本周签到
        </h3>

        <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
          <div className="grid grid-cols-7 gap-1">
            {last7.map((date, i) => {
              const record = checkin.records.find(r => r.date === date);
              const isToday = date === today;
              const isPast = date < today;
              return (
                <div key={date} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-text-muted">{WEEKDAYS[i]}</span>
                  <button
                    onClick={() => {
                      if (isPast && !record) handleMakeup(date);
                    }}
                    disabled={!!record || isToday || (!isPast)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                      record
                        ? record.type === 'makeup'
                          ? 'bg-blue-100 text-blue-600'
                          : record.type === 'team'
                            ? 'bg-accent/10 text-accent ring-2 ring-accent/30'
                            : 'bg-accent/10 text-accent'
                        : isToday
                          ? todayChecked
                            ? 'bg-accent/10 text-accent'
                            : 'bg-primary/10 text-primary border-2 border-primary'
                          : isPast
                            ? 'bg-gray-100 text-text-muted'
                            : 'bg-gray-50 text-text-muted/50'
                    }`}
                  >
                    {record || (isToday && todayChecked) ? '✓' : new Date(date).getDate()}
                  </button>

                  {isToday && <div className="w-1 h-1 rounded-full bg-primary" />}
                </div>

              );
            })}
          </div>

          {checkin.makeupCards > 0 && (
            <p className="text-[10px] text-text-muted mt-3 text-center">点击未签到的日期可使用补签卡</p>
          )}
        </div>

      </div>


      {/* Streak rewards */}
      <div className="mx-4 mt-4 mb-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Gift size={14} className="text-secondary" />
          连续签到奖励
        </h3>

        <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
          <div className="flex justify-between">
            {STREAK_REWARDS.map(r => {
              const reached = checkin.streak >= r.days;
              return (
                <div key={r.days} className="flex flex-col items-center gap-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm ${
                    reached ? 'bg-secondary/10 text-secondary' : 'bg-gray-100 text-text-muted'
                  }`}>
                    {reached ? '🎁' : '🔒'}
                  </div>

                  <span className="text-[10px] font-medium" style={{ color: reached ? '#f59e0b' : '#94a3b8' }}>
                    +{r.coins}⭐
                  </span>

                  {r.upDraws > 0 && (
                    <span className="text-[9px] font-medium" style={{ color: reached ? '#8B5CF6' : '#cbd5e1' }}>
                      +{r.upDraws}UP
                    </span>
                  )}

                  <span className="text-[9px] text-text-muted">{r.label}</span>
                </div>

              );
            })}
          </div>

        </div>

      </div>

    </div>

  );
}
