import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { BookOpen, Calendar, CheckCircle, ChevronLeft, ChevronRight, Flame, Sparkles, Star, Ticket } from 'lucide-react';
import { TopAppBar } from '@/components/layout';
import { useGame } from '@/store/GameContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { useUser } from '@/store/UserContext';
import { STREAK_REWARDS } from '@/data/incentive-mock';
import { getTodayLearningProgress } from '@/utils/dailyLearningProgress';
import { getLocalDateKey } from '@/utils/experience';
import { accountCheckin, accountMakeupCheckin } from '@/services/aiClient';
import { applyServerAccountPayload, isUnauthorizedError } from '@/store/accountSync';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function generateCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const paddedDays: Array<{ date: Date; dateStr: string; day: number } | null> =
    Array.from({ length: (firstDay.getDay() + 6) % 7 }, () => null);

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = new Date(year, month, day);
    paddedDays.push({ date, dateStr: formatLocalDate(date), day });
  }
  return paddedDays;
}

export default function CheckinPage() {
  const { userState, userDispatch, navigate } = useUser();
  const { learningState } = useLearning();
  const { gameState, gameDispatch } = useGame();
  const { theme } = useTheme();
  const { checkin, drawBalance, lastCheckinReward } = gameState;
  const { user } = userState;
  const today = getLocalDateKey();
  const todayChecked = checkin.records.some(record => record.date === today);
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [pendingMakeupDate, setPendingMakeupDate] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [makeupSubmitting, setMakeupSubmitting] = useState(false);
  const [accountError, setAccountError] = useState('');
  const checkinInFlightRef = useRef(false);

  const checkedDates = useMemo(() => new Set(checkin.records.map(record => record.date)), [checkin.records]);
  const calendarDays = useMemo(() => generateCalendar(currentYear, currentMonth), [currentYear, currentMonth]);
  const dailyGoal = Math.max(1, user?.dailyGoal ?? 10);
  const todayLearningProgress = useMemo(() => getTodayLearningProgress(learningState), [learningState]);
  const todayLearningCount = todayLearningProgress.totalCount;
  const goalProgress = Math.min((todayLearningCount / dailyGoal) * 100, 100);
  const goalAchieved = todayLearningCount >= dailyGoal;
  const pendingReviewCount = learningState.todayReviewItems.filter(item => !item.completed).length;
  const canCheckin = goalAchieved && !todayChecked;
  const nextMilestone = STREAK_REWARDS.find(reward => reward.days > checkin.streak);
  const uiStyle = theme.uiStyle || 'playful';
  const isScholar = uiStyle === 'scholar';

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear(year => year - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth(month => month - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear(year => year + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth(month => month + 1);
    }
  };

  const goToToday = () => {
    const date = new Date();
    setCurrentYear(date.getFullYear());
    setCurrentMonth(date.getMonth());
  };

  const getBorderRadius = (size: 'small' | 'medium' | 'large' = 'medium') => {
    const radiusMap: Record<string, Record<string, string>> = {
      small: { sm: '12px', md: '16px', lg: '20px' },
      medium: { sm: '16px', md: '20px', lg: '24px' },
      large: { sm: '20px', md: '24px', lg: '28px' },
      cute: { sm: '20px', md: '24px', lg: '32px' },
    };
    return radiusMap[theme.borderRadius]?.[size] ?? '20px';
  };

  const handleAccountError = (err: unknown) => {
    if (isUnauthorizedError(err)) {
      setAccountError('登录已过期，请重新登录');
      window.setTimeout(() => userDispatch({ type: 'LOGOUT' }), 900);
      return;
    }
    setAccountError(err instanceof Error ? err.message : '操作失败，请稍后重试');
  };

  const performCheckin = async () => {
    if (!canCheckin || !user || checkinInFlightRef.current) return;
    checkinInFlightRef.current = true;
    setCheckingIn(true);
    setAccountError('');
    try {
      applyServerAccountPayload(await accountCheckin(today), userDispatch, gameDispatch);
    } catch (err) {
      handleAccountError(err);
    } finally {
      checkinInFlightRef.current = false;
      setCheckingIn(false);
    }
  };

  const canMakeupDate = (date: string) => date < today && !checkedDates.has(date) && checkin.makeupCards > 0;

  const requestMakeup = (date: string) => {
    if (canMakeupDate(date)) setPendingMakeupDate(date);
  };

  const confirmMakeup = async () => {
    const date = pendingMakeupDate;
    if (!date || !canMakeupDate(date) || makeupSubmitting) {
      setPendingMakeupDate(null);
      return;
    }
    setMakeupSubmitting(true);
    setAccountError('');
    try {
      applyServerAccountPayload(await accountMakeupCheckin(date), userDispatch, gameDispatch);
      setPendingMakeupDate(null);
    } catch (err) {
      handleAccountError(err);
    } finally {
      setMakeupSubmitting(false);
    }
  };

  const dismissReward = () => {
    checkinInFlightRef.current = false;
    gameDispatch({ type: 'DISMISS_CHECKIN_REWARD' });
  };

  const cardStyle = {
    borderRadius: getBorderRadius('large'),
    backgroundColor: theme.bgCard || '#ffffff',
    border: `1px solid ${theme.border || '#e5e7eb'}`,
  };

  return (
    <div className="page-scroll" style={{ backgroundColor: theme.bg || '#f8f9fa' }}>
      {isScholar ? (
        <TopAppBar />
      ) : (
        <div className="bg-gradient-to-br from-primary to-primaryDark text-white p-5 pb-8">
          <button onClick={() => navigate('home')} className="mb-4 rounded-full bg-white/20 px-3 py-1.5 text-sm active:bg-white/30">
            返回
          </button>
          <h1 className="text-2xl font-bold">每日签到</h1>
          <p className="mt-1 text-sm text-white/80">完成今日学习目标后打卡，保持连续节奏。</p>
        </div>
      )}

      <div className={isScholar ? 'px-4 pt-4 pb-28 space-y-3' : 'px-4 -mt-4 pb-28 space-y-4'}>
        <section className="p-4 shadow-sm" style={cardStyle}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-primary" />
              <h2 className="text-sm font-bold text-text-primary">打卡日历</h2>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted active:bg-gray-100">
                <ChevronLeft size={18} />
              </button>
              <button onClick={goToToday} className="min-w-[6.5rem] rounded-lg bg-primary/10 px-2 py-1.5 text-xs font-semibold text-primary">
                {currentYear}年{currentMonth + 1}月
              </button>
              <button onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted active:bg-gray-100">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {WEEKDAYS.map(day => (
              <div key={day} className="py-1 text-center text-xs font-medium text-text-muted">
                {day}
              </div>
            ))}
            {calendarDays.map((day, index) => {
              if (!day) return <div key={index} className="aspect-square" />;
              const isChecked = checkedDates.has(day.dateStr);
              const isToday = day.dateStr === today;
              const canMakeup = canMakeupDate(day.dateStr);

              return (
                <button
                  key={day.dateStr}
                  onClick={() => requestMakeup(day.dateStr)}
                  disabled={!canMakeup}
                  className={`relative flex aspect-square items-center justify-center rounded-xl text-sm transition-transform ${canMakeup ? 'bg-amber-50 text-amber-700 active:scale-95' : isChecked ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-text-muted'} ${isToday ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                >
                  {isChecked ? <CheckCircle size={16} /> : day.day}
                  {canMakeup && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-amber-500" />}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-text-muted">
            <span>本月已打卡：{Array.from(checkedDates).filter(date => {
              const [year, month] = date.split('-');
              return Number(year) === currentYear && Number(month) === currentMonth + 1;
            }).length} 天</span>
            <span>补签卡 x{checkin.makeupCards}</span>
          </div>

          <div className="mt-4">
            {todayChecked ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-green-100 py-3 text-sm font-semibold text-green-600">
                <CheckCircle size={17} />
                今日已签到
              </div>
            ) : canCheckin ? (
              <button
                onClick={performCheckin}
                disabled={checkingIn}
                className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white active:opacity-85 disabled:opacity-60"
              >
                {checkingIn ? '签到中...' : '立即签到'}
              </button>
            ) : (
              <div className="rounded-xl bg-gray-100 py-3 text-center text-sm text-text-muted">
                完成学习任务后可签到
              </div>
            )}
            {accountError && (
              <div className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-600">
                {accountError}
              </div>
            )}
          </div>
        </section>

        <section className="flex items-center justify-between p-4 shadow-sm" style={cardStyle}>
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-orange-500" />
            <div>
              <div className="text-sm font-bold text-text-primary">连续签到 {checkin.streak} 天</div>
              <div className="text-xs text-text-muted">累计签到 {checkin.totalCheckins} 天</div>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            <Ticket size={14} />
            {drawBalance.regular + drawBalance.up}
          </div>
        </section>

        {todayChecked && (
          <section className="flex items-center gap-3 p-4 shadow-sm" style={{ ...cardStyle, backgroundColor: theme.secondaryFixed || '#ffdfa0' }}>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/60">
              <Star size={18} className="text-amber-600" fill="currentColor" />
            </div>
            <div>
              <div className="text-sm font-bold text-text-primary">签到成功</div>
              <div className="text-xs text-text-muted">
                {nextMilestone
                  ? `再签到 ${nextMilestone.days - checkin.streak} 天，解锁 ${nextMilestone.coins} 星币${nextMilestone.upDraws > 0 ? ` + ${nextMilestone.upDraws} UP抽签` : ''}`
                  : '已达成全部连续签到里程碑'}
              </div>
            </div>
          </section>
        )}

        <section className="p-4 shadow-sm" style={cardStyle} onClick={() => navigate('lottery')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                <Sparkles size={20} className="text-indigo-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">我的抽签</h3>
                <p className="mt-0.5 text-xs text-text-muted">常规 {drawBalance.regular} 次 · UP池 {drawBalance.up} 次</p>
              </div>
            </div>
            <span className="text-xs text-primary">去抽签 &gt;</span>
          </div>
        </section>

        <section className="p-4 shadow-sm" style={cardStyle}>
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-text-primary">
            <BookOpen size={14} className="text-primary" />
            今日学习目标
          </h3>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
                <span>今日完成</span>
                <span>{todayLearningCount} / {dailyGoal} 项</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${goalProgress}%`, backgroundColor: goalAchieved ? '#10b981' : theme.primary }} />
              </div>
            </div>
            <div className="border-t border-border pt-3">
              {goalAchieved ? (
                <p className="flex items-center gap-1 text-xs font-medium text-accent">
                  <CheckCircle size={12} />
                  已满足签到条件
                </p>
              ) : (
                <p className="text-xs text-text-muted">再完成 {Math.max(dailyGoal - todayLearningCount, 0)} 项学习量即可签到</p>
              )}
              {pendingReviewCount > 0 && (
                <p className="mt-1 text-xs text-text-muted">还有 {pendingReviewCount} 项待复习。</p>
              )}
            </div>
          </div>
        </section>
      </div>

      {pendingMakeupDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPendingMakeupDate(null)}>
          <div className="w-full max-w-sm bg-white p-5 shadow-2xl" style={{ borderRadius: getBorderRadius('large') }} onClick={event => event.stopPropagation()}>
            <h3 className="mb-2 text-lg font-bold text-text-primary">确认补签</h3>
            <p className="text-sm leading-6 text-text-muted">
              将使用 1 张补签卡补签 {pendingMakeupDate}。如果补签后刚好达成连续签到里程碑，会一并发放奖励。
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => setPendingMakeupDate(null)} className="rounded-xl bg-gray-100 py-3 text-sm font-medium text-text-muted active:opacity-80">
                取消
              </button>
              <button
                onClick={confirmMakeup}
                disabled={makeupSubmitting}
                className="rounded-xl bg-primary py-3 text-sm font-semibold text-white active:opacity-80 disabled:opacity-60"
              >
                {makeupSubmitting ? '补签中...' : '使用补签卡'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lastCheckinReward && (lastCheckinReward.regularTickets > 0 || lastCheckinReward.upTickets > 0 || lastCheckinReward.streakCoins > 0) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={dismissReward}>
          <div className="w-full max-w-sm bg-white p-6 pb-8 shadow-2xl" style={{ borderRadius: 24 }} onClick={event => event.stopPropagation()}>
            <div className="mb-3 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary shadow-lg">
                <Sparkles size={32} className="text-white" />
              </div>
            </div>
            <div className="mb-5 text-center">
              <h3 className="mb-1 text-xl font-bold text-text-primary">
                {lastCheckinReward.source === 'team_upgrade' ? '组队奖励已升级' : '签到成功'}
              </h3>
              <p className="text-sm text-text-muted">连续签到 <span className="font-bold text-primary">{checkin.streak}</span> 天</p>
            </div>

            <div className="mb-5 rounded-2xl border border-border bg-gray-50 p-4">
              <div className="mb-3 text-xs font-medium text-primary">本次获得</div>
              <div className="flex flex-wrap justify-center gap-3">
                {lastCheckinReward.regularTickets > 0 && (
                  <RewardItem icon={<Ticket size={22} className="text-blue-600" />} value={`+${lastCheckinReward.regularTickets}`} label="常规抽签" tone="blue" />
                )}
                {lastCheckinReward.upTickets > 0 && (
                  <RewardItem icon={<Sparkles size={22} className="text-purple-600" />} value={`+${lastCheckinReward.upTickets}`} label="UP池抽签" tone="purple" />
                )}
                {lastCheckinReward.streakCoins > 0 && (
                  <RewardItem icon={<Star size={22} className="text-amber-600" />} value={`+${lastCheckinReward.streakCoins}`} label="星币" tone="amber" />
                )}
              </div>
              {lastCheckinReward.streakLabel && (
                <div className="mt-3 border-t border-border pt-3 text-center text-xs text-primary">
                  连续签到 {lastCheckinReward.streakLabel} 里程碑奖励已发放
                </div>
              )}
            </div>

            {nextMilestone ? (
              <div className="mb-5 text-center text-xs text-text-muted">
                <p>
                  再签到 <span className="font-bold text-primary">{nextMilestone.days - checkin.streak}</span> 天，解锁 +{nextMilestone.coins} 星币
                  {nextMilestone.upDraws > 0 && <span className="text-purple-500"> +{nextMilestone.upDraws} UP抽签</span>}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.min(100, (checkin.streak / nextMilestone.days) * 100)}%` }} />
                </div>
              </div>
            ) : (
              <p className="mb-5 text-center text-xs text-text-muted">已达成全部连续签到里程碑。</p>
            )}

            <button onClick={dismissReward} className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-white active:opacity-80">
              太棒了，继续保持
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
function RewardItem({ icon, value, label, tone }: { icon: ReactNode; value: string; label: string; tone: 'blue' | 'purple' | 'amber' }) {
  const toneClass = {
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    amber: 'bg-amber-100 text-amber-700',
  }[tone];

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${toneClass}`}>{icon}</div>
      <span className="text-xs font-medium">{value}</span>
      <span className="text-[10px] text-text-muted">{label}</span>
    </div>
  );
}
