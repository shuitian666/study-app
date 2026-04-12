import { useState, useMemo } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useGame } from '@/store/GameContext';
import { useTheme } from '@/store/ThemeContext';
import { Calendar, Ticket, Flame, BookOpen, CheckCircle, Sparkles, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { STREAK_REWARDS } from '@/data/incentive-mock';
import { TopAppBar } from '@/components/layout';
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

// 生成当月日历数据
function generateCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay(); // 0 是周日
  
  // 转换为周一开头（中国日历习惯）
  const paddedDays: Array<{ date: Date; dateStr: string; day: number } | null> = Array.from({ length: (startingDayOfWeek + 6) % 7 }, () => null);
  
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    paddedDays.push({
      date,
      dateStr: date.toISOString().slice(0, 10),
      day: i
    });
  }
  
  return paddedDays;
}

export default function CheckinPage() {
  const { userState, userDispatch, navigate } = useUser();
  const { learningState } = useLearning();
  const { gameState, gameDispatch, checkAchievements } = useGame();
  const { theme } = useTheme();
  const { checkin, team, drawBalance, lastCheckinReward } = gameState;
  const { quizResults, todayReviewItems, todayNewItems } = learningState;
  const { user } = userState;
  const today = getToday();
  const todayChecked = checkin.records.some(r => r.date === today);

  const uiStyle = theme.uiStyle || 'playful';

  // 打卡日历状态
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  
  // 已打卡日期集合（用于快速判断）- 使用 useMemo 缓存
  const checkedDates = useMemo(() =>
    new Set(checkin.records.map(r => r.date)),
    [checkin.records]
  );
  
  // 生成当月日历
  const calendarDays = generateCalendar(currentYear, currentMonth);
  
  // 切换月份
  const prevMonth = () => {
    let newYear = currentYear;
    let newMonth = currentMonth - 1;
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    }
    setCurrentYear(newYear);
    setCurrentMonth(newMonth);
  };
  
  const nextMonth = () => {
    let newYear = currentYear;
    let newMonth = currentMonth + 1;
    if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    setCurrentYear(newYear);
    setCurrentMonth(newMonth);
  };
  
  const goToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  // 计算今日答题数量 - 使用 useMemo 缓存避免重复计算
  // 注意：使用 toISOString().slice(0, 10) 确保日期格式一致（UTC），与 AppContext 保持一致
  const todayResults = useMemo(() =>
    quizResults.filter(r => new Date(r.completedAt).toISOString().slice(0, 10) === today),
    [quizResults, today]
  );
  const todayQuestions = useMemo(() =>
    todayResults.reduce((sum, r) => sum + r.totalQuestions, 0),
    [todayResults]
  );

  // 学习目标
  const dailyGoal = user?.dailyGoal ?? 10;
  const dailyNewGoal = user?.dailyNewGoal ?? 15;
  const goalProgress = useMemo(() =>
    Math.min((todayQuestions / dailyGoal) * 100, 100),
    [todayQuestions, dailyGoal]
  );
  const goalAchieved = useMemo(() =>
    todayQuestions >= dailyGoal,
    [todayQuestions, dailyGoal]
  );

  // 复习完成检查
  const reviewCompleted = useMemo(() =>
    todayReviewItems.length === 0 || todayReviewItems.every(r => r.completed),
    [todayReviewItems]
  );

  // 新学完成检查：已完成的新学数 >= 每日新学目标
  const completedNewCount = useMemo(() =>
    todayNewItems.filter(r => r.completed).length,
    [todayNewItems]
  );
  const newLearnCompleted = useMemo(() =>
    completedNewCount >= dailyNewGoal,
    [completedNewCount, dailyNewGoal]
  );

  // 签到条件：复习完成 + 新学完成 OR 完成做题目标
  const canCheckin = useMemo(() =>
    ((reviewCompleted && newLearnCompleted) || goalAchieved) && !todayChecked,
    [reviewCompleted, newLearnCompleted, goalAchieved, todayChecked]
  );

  const last7 = getLast7Days();

  // Team check
  const hasActiveTeam = team?.status === 'active';
  const bothReady = hasActiveTeam && team!.members.every(m => m.progress.isReady);

  const performCheckin = (type: 'normal' | 'team') => {
    if (!canCheckin || !user) return;

    // 先计算新的签到天数和奖励
    const tempRecords = [...checkin.records, { date: today, type, teamId: type === 'team' ? team?.id : undefined }];
    const tempStreak = (() => {
      if (tempRecords.length === 0) return 0;
      const sorted = [...tempRecords].map(r => r.date).sort().reverse();
      let streak = 1;
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1]);
        const curr = new Date(sorted[i]);
        if (Math.round((prev.getTime() - curr.getTime()) / 86400000) === 1) streak++;
        else break;
      }
      return streak;
    })();

    // 计算奖励
    let streakCoins = 0;
    const streakReward = STREAK_REWARDS.find(r => r.days === tempStreak);
    if (streakReward) {
      streakCoins = streakReward.coins;
    }

    // 立即发放星币奖励
    if (streakCoins > 0) {
      userDispatch({
        type: 'UPDATE_USER',
        payload: { totalPoints: user.totalPoints + streakCoins }
      });
      // 记录星币账单
      gameDispatch({
        type: 'ADD_COIN_BILL',
        payload: {
          type: 'compensation',
          amount: streakCoins,
          description: `签到奖励: 连续${tempStreak}天`,
        }
      });
      console.log(`[签到奖励] 立即获得 ${streakCoins} 星币`);
    }

    // 执行签到
    gameDispatch({
      type: 'CHECKIN',
      payload: { date: today, type, teamId: type === 'team' ? team?.id : undefined },
    });

    // Check achievements - 签到后触发
    checkAchievements({ currentStreak: tempStreak });
  };

  const handleMakeup = (date: string) => {
    if (checkin.makeupCards <= 0) return;
    gameDispatch({ type: 'CHECKIN', payload: { date, type: 'makeup' } });
  };

  // 处理签到奖励中的星币
  const handleDismissReward = () => {
    // 星币已在签到时立即发放，这里只关闭弹窗
    gameDispatch({ type: 'DISMISS_CHECKIN_REWARD' });
  };

  // 根据主题获取圆角大小
  const getBorderRadius = (size: 'small' | 'medium' | 'large' = 'medium') => {
    const radiusMap: Record<string, Record<string, string>> = {
      small: { sm: '12px', md: '16px', lg: '20px' },
      medium: { sm: '16px', md: '20px', lg: '24px' },
      large: { sm: '20px', md: '24px', lg: '28px' },
      cute: { sm: '20px', md: '24px', lg: '32px' }
    };
    return radiusMap[theme.borderRadius][size];
  };

  // ===== Scholar 风格渲染 =====
  if (uiStyle === 'scholar') {
    return (
      <div className="page-scroll" style={{ backgroundColor: theme.bg || '#f8f9fa' }}>
        <TopAppBar />

        <div className="px-6 pt-6 space-y-6 pb-32">
          {/* Hero Streak & Reward Section - Asymmetric Bento */}
          <div className="grid grid-cols-2 gap-4">
            {/* Streak Card - Primary gradient */}
            <div
              className="col-span-2 md:col-span-1 p-6 rounded-lg relative overflow-hidden flex flex-col justify-between h-44"
              style={{
                background: `linear-gradient(135deg, ${theme.primary}, ${theme.tertiary || '#73008e'})`,
              }}
            >
              <div className="relative z-10">
                <span
                  className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase mb-3"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }}
                >
                  Daily Streak
                </span>
                <h2 className="text-3xl font-black" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#ffffff' }}>
                  连续签到 {checkin.streak} 天
                </h2>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  继续保持！离下一个里程碑仅差 3 天。
                </p>
              </div>
              <div className="mt-4 relative z-10">
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                  <div className="h-full rounded-full" style={{ backgroundColor: theme.secondaryContainer || '#ffbf00', width: '70%' }} />
                </div>
              </div>
              {/* Abstract background shapes */}
              <div
                className="absolute top-[-20%] right-[-10%] w-40 h-40 rounded-full opacity-20"
                style={{ backgroundColor: '#ffffff', filter: 'blur(40px)' }}
              />
            </div>

            {/* Reward Card */}
            <div
              className="col-span-2 md:col-span-1 p-6 rounded-lg flex flex-col items-center justify-center text-center h-44"
              style={{
                backgroundColor: theme.surfaceContainerLowest || '#ffffff',
                boxShadow: 'none',
              }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
                style={{ backgroundColor: theme.secondaryFixed || '#ffdfa0' }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={theme.onSecondaryFixed || '#261a00'} strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: theme.onSurface }}>恭喜获得奖励!</h3>
              <p className="text-sm mt-1" style={{ color: theme.onSurfaceVariant || '#454652' }}>今日获得 50 学习积分</p>
            </div>
          </div>

          {/* Calendar Section */}
          <div
            className="p-6 rounded-lg"
            style={{ backgroundColor: theme.surfaceContainerLow || '#f3f4f5' }}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: theme.onSurface }}>
                签到日历
              </h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={prevMonth}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: theme.onSurfaceVariant }}
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="font-bold" style={{ color: theme.onSurface }}>{currentYear}年 {currentMonth + 1}月</span>
                <button
                  onClick={nextMonth}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: theme.onSurfaceVariant }}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {WEEKDAYS.map(day => (
                <div key={day} className="text-center text-xs font-bold uppercase" style={{ color: theme.outline || '#757684' }}>
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, index) => {
                if (!day) return <div key={index} className="aspect-square" />;

                const isChecked = checkedDates.has(day.dateStr);
                const isToday = day.dateStr === today;

                return (
                  <div
                    key={index}
                    className="aspect-square flex items-center justify-center relative transition-all duration-300 hover:scale-105 cursor-pointer"
                    style={{
                      borderRadius: '50%',
                      backgroundColor: isChecked
                        ? theme.primary
                        : isToday
                          ? `${theme.primary}20`
                          : 'transparent',
                      color: isChecked
                        ? '#ffffff'
                        : isToday
                          ? theme.primary
                          : theme.onSurfaceVariant,
                      fontWeight: isChecked || isToday ? 'bold' : 'normal',
                      fontSize: '14px',
                    }}
                  >
                    {day.day}
                    {isToday && !isChecked && (
                      <div
                        className="absolute -bottom-0.5 w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: theme.primary }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Checkin Button Section */}
          <div
            className="p-6 rounded-lg"
            style={{ backgroundColor: theme.surfaceContainerLowest || '#ffffff', boxShadow: 'none' }}
          >
            {todayChecked ? (
              <div
                className="w-full py-4 rounded-xl text-center font-medium"
                style={{ backgroundColor: `${theme.primary}15`, color: theme.primary }}
              >
                今日已签到 ✓
              </div>
            ) : !canCheckin ? (
              <div
                className="w-full py-4 rounded-xl text-center"
                style={{ backgroundColor: theme.surfaceContainerHigh || '#e7e8e9', color: theme.onSurfaceVariant }}
              >
                完成学习任务后可签到
              </div>
            ) : (
              <button
                onClick={() => performCheckin('normal')}
                className="w-full py-4 rounded-xl font-bold active:scale-[0.98] transition-transform"
                style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.tertiary || '#73008e'})`, color: '#ffffff' }}
              >
                立即签到
              </button>
            )}

            {/* Streak info */}
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <Flame size={18} style={{ color: '#f97316' }} />
                <span className="text-sm font-bold" style={{ color: theme.onSurface }}>连续 {checkin.streak} 天</span>
              </div>
              <div className="flex items-center gap-1">
                <Ticket size={14} style={{ color: theme.secondary || '#795900' }} />
                <span className="text-xs" style={{ color: theme.onSurfaceVariant }}>补签卡 x{checkin.makeupCards}</span>
              </div>
            </div>
          </div>

          {/* Achievement Badges */}
          <div
            className="p-6 rounded-lg"
            style={{ backgroundColor: theme.surfaceContainerLow || '#f3f4f5' }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: theme.onSurface }}>成就勋章</h3>
            <div className="flex flex-wrap gap-6">
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: `${theme.primary}20` }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.primary} strokeWidth="2">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                </div>
                <span className="text-xs font-bold" style={{ color: theme.onSurface }}>初学者</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: `${theme.secondary}20` }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.secondary} strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                </div>
                <span className="text-xs font-bold" style={{ color: theme.onSurface }}>知识达人</span>
              </div>
              <div className="flex flex-col items-center gap-2 opacity-40">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: theme.surfaceContainerHighest || '#e1e3e4' }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.outline || '#757684'} strokeWidth="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <span className="text-xs font-bold" style={{ color: theme.onSurface }}>学霸领袖</span>
              </div>
            </div>
          </div>

          {/* Lucky Wheel Card */}
          <div
            className="p-6 rounded-lg relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${theme.tertiaryFixed || '#fdd6ff'}, ${theme.tertiary || '#73008e'})` }}
          >
            <div
              className="rounded-lg p-6"
              style={{ backgroundColor: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(10px)' }}
            >
              <span className="text-xs font-bold uppercase tracking-wider opacity-70" style={{ color: theme.onTertiaryFixed || '#340042' }}>
                Daily Luck
              </span>
              <h3 className="text-xl font-black mt-1 mb-4" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: theme.onTertiaryFixed || '#340042' }}>
                幸运大转盘
              </h3>
              <p className="text-sm font-medium mb-4 opacity-80" style={{ color: theme.onTertiaryFixed || '#340042' }}>
                今日剩余抽奖机会: <span className="font-bold">1</span> 次
              </p>
              <button
                onClick={() => navigate('lottery')}
                className="w-full py-3 rounded-xl font-bold active:scale-[0.98] transition-transform"
                style={{ backgroundColor: theme.tertiary || '#73008e', color: '#ffffff' }}
              >
                开始抽奖
              </button>
            </div>
          </div>
        </div>

        {/* Floating AI Button */}
        <button
          className="fixed bottom-24 right-6 px-6 py-4 rounded-full shadow-xl flex items-center gap-3 z-40"
          style={{
            backgroundColor: theme.tertiaryFixed || '#fdd6ff',
            color: theme.onTertiaryFixed || '#340042',
            boxShadow: `0 8px 24px -4px rgba(115, 0, 142, 0.3)`,
          }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: theme.tertiary || '#73008e', color: '#ffffff' }}
          >
            <Sparkles size={16} />
          </div>
          <span className="font-bold text-sm">AI 助教建议</span>
        </button>
      </div>
    );
  }

  // ===== Playful 风格渲染 =====
  return (
    <div className="page-scroll pb-4">
      {/* 渐变头部背景 */}
      <div className="bg-gradient-to-br" style={{ backgroundImage: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDark})`, color: 'white', padding: '16px 24px 28px 24px', borderRadius: '0 0 32px 32px', marginBottom: '16px' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">每日签到</h2>
            <p className="text-white/70 text-sm mt-1">坚持学习，每日进步</p>
          </div>
          <button
            onClick={() => navigate('home')}
            className="p-2 bg-white/20 rounded-full active:bg-white/30 transition-colors"
          >
            <span className="text-white text-sm">返回</span>
          </button>
        </div>
      </div>

      {/* Streak header */}
      <div className="bg-white border border-border shadow-sm mx-4 p-5" style={{ borderRadius: getBorderRadius('large') }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Flame size={18} className="text-orange-500" />
              <span className="text-lg font-bold text-text-primary">连续签到 {checkin.streak} 天</span>
            </div>
            <p className="text-text-muted text-xs">累计签到 {checkin.totalCheckins} 天</p>
          </div>
          <div className="flex items-center gap-1 bg-orange-100 rounded-full px-3 py-1">
            <Ticket size={14} className="text-orange-500" />
            <span className="text-sm text-orange-600">补签卡 x{checkin.makeupCards}</span>
          </div>
        </div>

        {/* Checkin button(s) */}
        {todayChecked ? (
          <div className="w-full py-3 rounded-xl bg-green-100 text-green-600 text-center text-sm font-medium">
            今日已签到 ✓
          </div>
        ) : !canCheckin ? (
          <div className="w-full py-3 rounded-xl bg-gray-100 text-text-muted text-center text-sm cursor-default">
            完成学习任务后可签到
          </div>
        ) : hasActiveTeam && bothReady ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => performCheckin('normal')}
              className="py-3 rounded-xl bg-orange-100 text-orange-600 text-sm font-medium active:scale-[0.97] transition-transform"
            >
              独立签到
            </button>
            <button
              onClick={() => performCheckin('team')}
              className="py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg text-sm font-medium active:scale-[0.97] transition-transform"
            >
              组队签到
            </button>
          </div>
        ) : (
          <button
            onClick={() => performCheckin('normal')}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg font-medium text-sm active:scale-[0.97] transition-transform"
          >
            立即签到
          </button>
        )}
      </div>


      {/* 打卡日历 */}
      <div className="mx-4 mt-3 bg-white border border-border shadow-md p-4" style={{ borderRadius: '20px' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-text-primary font-semibold text-sm flex items-center gap-1.5">
            <Calendar size={16} className="text-primary" />
            打卡日历
          </h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-gray-50 text-text-muted transition-colors"
              style={{ borderRadius: '12px' }}
            >
              ‹
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-lg font-medium hover:bg-primary/20 transition-colors"
              style={{ borderRadius: '12px' }}
            >
              {currentYear}年{currentMonth + 1}月
            </button>
            <button 
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-gray-50 text-text-muted transition-colors"
              style={{ borderRadius: '12px' }}
            >
              ›
            </button>
          </div>
        </div>

        {/* 星期表头 */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {WEEKDAYS.map(day => (
            <div key={day} className="text-center text-xs font-medium text-text-muted py-2">
              {day}
            </div>
          ))}
        </div>

        {/* 日期格子 */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day, index) => {
            if (!day) return <div key={index} className="aspect-square" />;
            
            const isChecked = checkedDates.has(day.dateStr);
            const isToday = day.dateStr === today;
            
            return (
              <div
                key={index}
                className={`aspect-square flex items-center justify-center relative transition-all duration-300 hover:scale-105 cursor-pointer ${
                  isChecked
                    ? 'bg-green-50 text-green-600 font-medium'
                    : 'bg-gray-50 text-text-muted hover:bg-gray-100'
                } ${
                  isToday
                    ? 'ring-2 ring-primary ring-offset-2'
                    : ''
                }`}
                style={{ 
                  borderRadius: '12px',
                  boxShadow: isChecked 
                    ? 'inset 0 0 0 1px rgba(16, 185, 129, 0.2), 0 2px 4px rgba(16, 185, 129, 0.1)'
                    : 'none'
                }}
              >
                {isChecked ? <CheckCircle size={16} className="text-green-500" /> : <span className="text-sm">{day.day}</span>}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-4 text-xs text-text-muted">
          <span>本月已打卡：{Array.from(checkedDates).filter(d => {
            const [y, m] = d.split('-');
            return Number(y) === currentYear && Number(m) === currentMonth + 1;
          }).length} 天</span>
          <span>累计：{checkin.totalCheckins} 天</span>
        </div>
      </div>

      {/* Draw balance card - link to lottery */}
      <div
        className="mx-4 mt-3 bg-white border border-border shadow-sm p-4 active:opacity-90 transition-opacity cursor-pointer"
        style={{ borderRadius: getBorderRadius('large') }}
        onClick={() => navigate('lottery')}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <Sparkles size={20} className="text-indigo-500" />
            </div>
            <div>
              <h4 className="text-text-primary font-semibold text-sm">我的抽签</h4>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-text-muted text-xs">常规 {drawBalance.regular} 次</span>
                <span className="text-text-muted text-xs">UP池 {drawBalance.up} 次</span>
              </div>
            </div>
          </div>
          <span className="text-primary text-xs">去抽签 &gt;</span>
        </div>

      </div>


      {/* Today's learning goal progress */}
      <div className="mx-4 mt-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <BookOpen size={14} className="text-primary" />
          今日学习目标
        </h3>

        <div className="bg-white p-4 border border-border shadow-sm space-y-3" style={{ borderRadius: getBorderRadius('large') }}>
          {/* 做题进度 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-muted">做题进度</span>
              <span className="text-xs text-text-muted">{todayQuestions} / {dailyGoal} 题</span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.round(goalProgress))}%`,
                  backgroundColor: goalAchieved ? '#10b981' : '#f59e0b',
                }}
              />
            </div>
          </div>

          {/* 新学进度 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-muted">新学进度</span>
              <span className="text-xs text-text-muted">{completedNewCount} / {dailyNewGoal} 个</span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100,(completedNewCount / dailyNewGoal) * 100)}%`,
                  backgroundColor: newLearnCompleted ? '#10b981' : '#3b82f6',
                }}
              />
            </div>
          </div>

          {/* 签到条件提示 */}
          <div className="pt-2 border-t border-border">
            {(reviewCompleted && newLearnCompleted) || goalAchieved ? (
              <p className="text-xs text-accent font-medium flex items-center gap-1">
                <CheckCircle size={12} /> 已满足签到条件
              </p>
            ) : (
              <p className="text-xs text-text-muted">
                {reviewCompleted 
                  ? `再完成 ${dailyNewGoal - completedNewCount} 个新学即可签到` 
                  : '完成复习和新学任务后即可签到'}
              </p>
            )}
          </div>
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

        <div className="bg-white p-4 border border-border shadow-sm" style={{ borderRadius: getBorderRadius('large') }}>
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

                  {isToday && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-0.5" />}
                </div>

              );
            })}
          </div>

          {checkin.makeupCards > 0 && (
            <p className="text-[10px] text-text-muted mt-3 text-center">点击未签到的日期可使用补签卡</p>
          )}
        </div>

      </div>


      {/* Checkin Success Modal */}
      {lastCheckinReward && (lastCheckinReward.regularTickets > 0 || lastCheckinReward.upTickets > 0 || lastCheckinReward.streakCoins > 0) && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={handleDismissReward}>
          <div
            className="bg-white w-full max-w-sm rounded-3xl p-6 pb-8 animate-slide-up shadow-2xl"
            onClick={e => e.stopPropagation()}
            style={{ borderRadius: '24px' }}
          >
            {/* Confetti animation indicator */}
            <div className="flex justify-center mb-2">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                <Sparkles size={32} className="text-white" />
              </div>
            </div>

            {/* Title */}
            <div className="text-center mb-5">
              <h3 className="text-xl font-bold text-text-primary mb-1">签到成功</h3>
              <p className="text-sm" style={{ color: theme.textSecondary }}>
                连续签到 <span className="text-primary font-bold">{checkin.streak}</span> 天
              </p>
            </div>

            {/* Rewards */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 mb-5 border border-amber-200/60">
              <div className="text-xs text-amber-700 mb-3 font-medium">本次获得</div>
              <div className="flex flex-wrap gap-3 justify-center">
                {lastCheckinReward.regularTickets > 0 && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Ticket size={22} className="text-blue-600" />
                    </div>
                    <span className="text-xs font-medium text-blue-700">+{lastCheckinReward.regularTickets}</span>
                    <span className="text-[10px] text-blue-500">常规抽签</span>
                  </div>
                )}
                {lastCheckinReward.upTickets > 0 && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <Sparkles size={22} className="text-purple-600" />
                    </div>
                    <span className="text-xs font-medium text-purple-700">+{lastCheckinReward.upTickets}</span>
                    <span className="text-[10px] text-purple-500">UP池抽签</span>
                  </div>
                )}
                {lastCheckinReward.streakCoins > 0 && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                      <Star size={22} className="text-amber-600" />
                    </div>
                    <span className="text-xs font-medium text-amber-700">+{lastCheckinReward.streakCoins}</span>
                    <span className="text-[10px] text-amber-500">星币</span>
                  </div>
                )}
              </div>
              {lastCheckinReward.streakLabel && (
                <div className="mt-3 pt-3 border-t border-amber-200/60 text-center">
                  <p className="text-xs text-amber-700">
                    🎉 连续签到 {lastCheckinReward.streakLabel} 里程碑奖励已发放！
                  </p>
                </div>
              )}
            </div>

            {/* Next streak milestone hint */}
            {(() => {
              const nextMilestone = STREAK_REWARDS.find(r => r.days > checkin.streak);
              if (!nextMilestone) {
                return (
                  <div className="text-center text-xs mb-5" style={{ color: theme.textSecondary }}>
                    <p>已达成全部连续签到里程碑！</p>
                  </div>
                );
              }
              return (
                <div className="text-center text-xs mb-5" style={{ color: theme.textSecondary }}>
                  <p>再签到 <span className="text-primary font-bold">{nextMilestone.days - checkin.streak}</span> 天，解锁 +{nextMilestone.coins}星币
                    {nextMilestone.upDraws > 0 && <span className="text-purple-500"> +{nextMilestone.upDraws}UP抽</span>}
                  </p>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (checkin.streak / nextMilestone.days) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Close button */}
            <button
              onClick={handleDismissReward}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-primaryDark text-white font-medium text-sm active:opacity-80 transition-opacity"
            >
              太棒了，继续保持
            </button>

          </div>
        </div>
      )}

    </div>

  );
}
