import { useEffect, useState } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useGame } from '@/store/GameContext';
import { useTheme } from '@/store/ThemeContext';
import { PROFICIENCY_MAP } from '@/types';
import type { ProficiencyLevel, KnowledgePoint, QuizResult } from '@/types';
import { allFrames, allTitles } from '@/pages/AvatarEdit';
import { Settings, ChevronRight, BookOpen, Award, Star, LogOut, CalendarCheck, Trophy, ShoppingBag, Medal, Backpack, Mail, X } from 'lucide-react';

// 获取圆角值
export function getBorderRadius(size: 'small' | 'large') {
  return size === 'large' ? '16px' : '8px';
}

export default function ProfilePage() {
  const { userState, userDispatch, navigate } = useUser();
  const { learningState, getLearningStats } = useLearning();
  const { gameState } = useGame();
  const { theme } = useTheme();
  const stats = getLearningStats();
  const user = userState.user;
  const isCustomAvatar = user ? (user.avatar?.startsWith('data:') || user.avatar?.startsWith('http')) ?? false : false;
  
  // 动画效果 - 使用主界面动画设置
  const [animationEffect, setAnimationEffect] = useState(() => {
    const saved = localStorage.getItem('main-animation-effect');
    return saved || 'slide-up';
  });

  // 监听动画效果变化
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'main-animation-effect' && e.newValue) {
        setAnimationEffect(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  
  // 获取动画类名
  const getAnimationClass = (delay: number) => {
    const baseClass = `scroll-${animationEffect}`;
    const delayClass = `reveal-delay-${delay}`;
    return `${baseClass} ${delayClass}`;
  };

  // 获取当前使用的称号
  const currentTitle = allTitles.find(t => t.id === user?.activeTitle);

  const profData: { level: ProficiencyLevel; count: number }[] = [
    { level: 'master', count: stats.masteredCount },
    { level: 'normal', count: stats.normalCount },
    { level: 'rusty', count: stats.rustyCount },
    { level: 'none', count: stats.noneCount },
  ];

  // ========== 学习总结统计 ==========
  type SummaryPeriod = 'week' | 'month';
  const [showSummary, setShowSummary] = useState<SummaryPeriod | null>(null);
  const [summaryDate, setSummaryDate] = useState<Date>(new Date());

  // 获取时间范围起始
  const getStartDate = (period: SummaryPeriod, date: Date = new Date()): string => {
    const now = date;
    let start: Date;
    if (period === 'week') {
      // 本周一
      start = new Date(now);
      const day = start.getDay() || 7;
      start.setDate(start.getDate() - day + 1);
    } else {
      // 本月一号
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return start.toISOString().slice(0, 10);
  };

  // 获取时间范围结束
  const getEndDate = (period: SummaryPeriod, date: Date = new Date()): string => {
    const now = date;
    let end: Date;
    if (period === 'week') {
      // 本周日
      end = new Date(now);
      const day = end.getDay() || 7;
      end.setDate(end.getDate() - day + 7);
    } else {
      // 本月最后一天
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    return end.toISOString().slice(0, 10);
  };

  // 计算统计数据
  const calculateSummary = (period: SummaryPeriod, date: Date = new Date()) => {
    const startDateStr = getStartDate(period, date);
    const endDateStr = getEndDate(period, date);

    // 1. 本周/月新增知识点
    const newKnowledge = learningState.knowledgePoints.filter(kp => {
      return kp.createdAt >= startDateStr && kp.createdAt <= endDateStr;
    });

    // 2. 掌握的知识点（掌握度 master 或 normal 算掌握）
    const masteredInPeriod = newKnowledge.filter(kp => 
      kp.proficiency === 'master' || kp.proficiency === 'normal'
    );

    // 3. 测验统计
    const periodQuizzes = learningState.quizResults.filter(q => {
      const qDate = new Date(q.completedAt).toISOString().slice(0, 10);
      return qDate >= startDateStr && qDate <= endDateStr;
    });

    const totalQuestions = periodQuizzes.reduce((sum, q) => sum + q.totalQuestions, 0);
    const correctQuestions = periodQuizzes.reduce((sum, q) => sum + q.correctCount, 0);
    const accuracy = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0;

    // 4. 连续打卡天数
    const currentStreak = gameState.checkin.streak;

    return {
      newKnowledgeCount: newKnowledge.length,
      masteredCount: masteredInPeriod.length,
      totalQuizzes: periodQuizzes.length,
      totalQuestions,
      accuracy,
      currentStreak,
      periodLabel: period === 'week' ? '本周' : '本月'
    };
  };

  const menuItems = [
    { icon: BookOpen, label: '我的学科', value: `${learningState.subjects.length}个`, color: 'text-blue-500' },
    { icon: Award, label: '测试记录', value: `${stats.totalQuizzes}次`, color: 'text-orange-500' },
    { icon: Star, label: '平均分数', value: `${stats.averageScore}分`, color: 'text-yellow-500' },
  ];

  return (
    <div className="page-scroll pb-4">
      {/* Profile Header - 渐变背景，与首页风格统一 */}
      <div className="bg-gradient-to-br from-primary to-primary-dark text-white px-5 pt-10 pb-8 rounded-b-[40px]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* 头像区域 - 可点击编辑 */}
            <button
              onClick={() => navigate('avatar-edit')}
              className="relative"
            >
              {/* 头像框 */}
              {user?.avatarFrame ? (
                (() => {
                  const frameConfig = allFrames.find(f => f.icon === user.avatarFrame);
                  if (!frameConfig) return null;
                  return (
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center ${frameConfig.animation ? 'animate-gradient-shift' : ''}`}
                      style={{
                        background: frameConfig.gradient,
                        clipPath: frameConfig.shapeTransform || 'circle(50%)',
                        backgroundSize: frameConfig.animation ? '200% 200%' : '100% 100%',
                      }}
                    >
                      <div className="bg-white/20 rounded-full flex items-center justify-center p-1 w-[calc(100%-8px)] h-[calc(100%-8px)]">
                        {isCustomAvatar ? (
                          <img src={user.avatar} alt="头像" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <span className="text-2xl">{user.avatar || '👤'}</span>
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
                <div 
                  className="w-14 h-14 rounded-full flex items-center justify-center text-2xl bg-white/20"
                >
                  {isCustomAvatar && user?.avatar ? (
                    <img src={user.avatar} alt="头像" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    user?.avatar || '👤'
                  )}
                </div>
              )}
              {/* 编辑提示 */}
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-white text-[8px]">
                ✎
              </div>
            </button>
            <div className="flex flex-col">
              <h2 className="text-lg font-bold">{user?.nickname ?? '未登录'}</h2>
              {currentTitle && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 self-start" style={{
                  background: currentTitle.gradient,
                  color: currentTitle.textColor
                }}>
                  {currentTitle.icon} {currentTitle.name}
                </span>
              )}
              <p className="text-white/70 text-xs mt-0.5">已学习 {stats.streakDays} 天</p>
            </div>
          </div>
          <button
            onClick={() => navigate('settings')}
            className="p-2 bg-white/20 rounded-full active:bg-white/30 transition-colors"
          >
            <Settings size={18} className="text-white" />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-white">{stats.totalKnowledgePoints}</div>
            <div className="text-[10px] text-white/70">知识点</div>
          </div>
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-white">{stats.streakDays}</div>
            <div className="text-[10px] text-white/70">学习天数</div>
          </div>
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-white">{user?.totalPoints ?? 0}</div>
            <div className="text-[10px] text-white/70">星币</div>
          </div>
        </div>
      </div>

      {/* Learning Profile */}
      <div className={`px-4 mt-4 ${getAnimationClass(1)}`}>
        <h3 className="font-semibold text-sm mb-3" style={{ color: theme.textPrimary }}>学习档案</h3>
        <div className="rounded-2xl p-4 border shadow-sm" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
          <div className="flex items-center justify-between text-xs mb-3" style={{ color: theme.textMuted }}>
            <span>掌握度分布</span>
            <span>共 {stats.totalKnowledgePoints} 个知识点</span>
          </div>

          {/* Stacked bar */}
          <div className="w-full h-4 rounded-full overflow-hidden flex" style={{ backgroundColor: theme.border }}>
            {profData.map(d => {
              const pct = stats.totalKnowledgePoints > 0 ? (d.count / stats.totalKnowledgePoints) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={d.level}
                  className="h-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: PROFICIENCY_MAP[d.level].color }}
                />
              );
            })}
          </div>

          <div className="grid grid-cols-4 gap-2 mt-3">
            {profData.map(d => (
              <div key={d.level} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PROFICIENCY_MAP[d.level].color }} />
                <span className="text-[10px]" style={{ color: theme.textMuted }}>{PROFICIENCY_MAP[d.level].label} {d.count}</span>
              </div>
            ))}
          </div>

          {/* Weak subjects */}
          {stats.weakSubjects.length > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${theme.border}` }}>
              <div className="text-xs mb-1.5" style={{ color: theme.textMuted }}>薄弱学科</div>
              <div className="flex flex-wrap gap-1.5">
                {stats.weakSubjects.map(s => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 学习总结 */}
      <div className={`px-4 mt-4 ${getAnimationClass(2)}`}>
        <h3 className="font-semibold text-sm mb-3" style={{ color: theme.textPrimary }}>学习总结</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowSummary('week')}
            className="rounded-xl p-4 border shadow-sm text-left transition-all active:scale-[0.98]"
            style={{ 
              backgroundColor: theme.bgCard, 
              borderColor: theme.border, 
              borderRadius: getBorderRadius('large') 
            }}
          >
            <CalendarCheck size={20} className="text-green-500 mb-2" />
            <h4 className="font-semibold text-sm" style={{ color: theme.textPrimary }}>本周总结</h4>
            <p className="text-[10px]" style={{ color: theme.textMuted }}>查看本周学习数据</p>
          </button>

          <button
            onClick={() => setShowSummary('month')}
            className="rounded-xl p-4 border shadow-sm text-left transition-all active:scale-[0.98]"
            style={{ 
              backgroundColor: theme.bgCard, 
              borderColor: theme.border, 
              borderRadius: getBorderRadius('large') 
            }}
          >
            <Trophy size={20} className="text-amber-500 mb-2" />
            <h4 className="font-semibold text-sm" style={{ color: theme.textPrimary }}>本月总结</h4>
            <p className="text-[10px]" style={{ color: theme.textMuted }}>查看本月学习成果</p>
          </button>
        </div>
      </div>

      {/* 总结卡片弹窗 */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div 
            className="bg-white rounded-3xl max-w-sm w-full overflow-hidden relative"
            style={{ borderRadius: getBorderRadius('large') }}
            id="summary-card"
          >
            {/* 关闭按钮 */}
            <button
              onClick={() => setShowSummary(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
            >
              <X size={16} />
            </button>

            {(() => {
              const summary = calculateSummary(showSummary, summaryDate);
              
              // 月份切换函数
              const prevMonth = () => {
                const newDate = new Date(summaryDate);
                newDate.setMonth(newDate.getMonth() - 1);
                setSummaryDate(newDate);
              };
              
              const nextMonth = () => {
                const newDate = new Date(summaryDate);
                newDate.setMonth(newDate.getMonth() + 1);
                setSummaryDate(newDate);
              };
              
              const goToToday = () => {
                setSummaryDate(new Date());
              };
              
              // 格式化日期显示
              const formatDate = (date: Date) => {
                if (showSummary === 'month') {
                  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
                } else {
                  const start = getStartDate('week', date);
                  const end = getEndDate('week', date);
                  return `${start} ~ ${end}`;
                }
              };
              
              return (
                <div className="p-6">
                  {/* 头部渐变 */}
                  <div className="bg-gradient-to-br text-white -mx-6 -mt-6 px-6 pt-8 pb-10 mb-6" style={{ backgroundImage: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDark})` }}>
                    <div className="flex items-center justify-between mb-2">
                      <button 
                        onClick={prevMonth}
                        className="p-2 rounded-full hover:bg-white/20 transition-colors"
                      >
                        ‹
                      </button>
                      <div className="text-center flex-1">
                        <h2 className="text-lg font-bold">{summary.periodLabel}学习总结</h2>
                        <p className="text-white/80 text-xs mt-1">{formatDate(summaryDate)}</p>
                      </div>
                      <button 
                        onClick={nextMonth}
                        className="p-2 rounded-full hover:bg-white/20 transition-colors"
                      >
                        ›
                      </button>
                    </div>
                    <p className="text-white/80 text-xs text-center">坚持学习，每天进步一点</p>
                  </div>

                  {/* 数据统计 */}
                  <div className="grid grid-cols-2 gap-5 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: theme.primary }}>{summary.newKnowledgeCount}</div>
                      <div className="text-xs mt-1" style={{ color: theme.textMuted }}>新知识</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: theme.success }}>{summary.masteredCount}</div>
                      <div className="text-xs mt-1" style={{ color: theme.textMuted }}>已掌握</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: theme.warning }}>{summary.accuracy}%</div>
                      <div className="text-xs mt-1" style={{ color: theme.textMuted }}>正确率</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: theme.accent }}>{summary.currentStreak}</div>
                      <div className="text-xs mt-1" style={{ color: theme.textMuted }}>连续打卡</div>
                    </div>
                  </div>

                  {/* 学习数据统计图 */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium mb-3" style={{ color: theme.textPrimary }}>学习数据统计</h4>
                    <div className="h-40 bg-gray-50 rounded-lg p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
                      <div className="flex items-end justify-around h-full">
                        {/* 新知识条形 */}
                        <div className="flex flex-col items-center" style={{ width: '20%' }}>
                          <div 
                            className="w-8 rounded-t-lg transition-all duration-500"
                            style={{ 
                              height: `${Math.min(100, (summary.newKnowledgeCount / 20) * 100)}%`,
                              backgroundColor: theme.primary,
                              minHeight: '10px'
                            }}
                          />
                          <span className="text-[10px] mt-1" style={{ color: theme.textMuted }}>新学</span>
                        </div>
                        {/* 已掌握条形 */}
                        <div className="flex flex-col items-center" style={{ width: '20%' }}>
                          <div 
                            className="w-8 rounded-t-lg transition-all duration-500"
                            style={{ 
                              height: `${Math.min(100, (summary.masteredCount / 20) * 100)}%`,
                              backgroundColor: theme.success,
                              minHeight: '10px'
                            }}
                          />
                          <span className="text-[10px] mt-1" style={{ color: theme.textMuted }}>掌握</span>
                        </div>
                        {/* 正确率条形 */}
                        <div className="flex flex-col items-center" style={{ width: '20%' }}>
                          <div 
                            className="w-8 rounded-t-lg transition-all duration-500"
                            style={{ 
                              height: `${summary.accuracy}%`,
                              backgroundColor: theme.warning,
                              minHeight: '10px'
                            }}
                          />
                          <span className="text-[10px] mt-1" style={{ color: theme.textMuted }}>正确率</span>
                        </div>
                        {/* 连续打卡条形 */}
                        <div className="flex flex-col items-center" style={{ width: '20%' }}>
                          <div 
                            className="w-8 rounded-t-lg transition-all duration-500"
                            style={{ 
                              height: `${Math.min(100, (summary.currentStreak / 30) * 100)}%`,
                              backgroundColor: theme.accent,
                              minHeight: '10px'
                            }}
                          />
                          <span className="text-[10px] mt-1" style={{ color: theme.textMuted }}>连续</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 底部提示 */}
                  <div className="mt-6 pt-4 border-t" style={{ borderColor: theme.border }}>
                    <p className="text-xs text-center" style={{ color: theme.textMuted }}>
                      {summary.periodLabel}共完成 {summary.totalQuizzes} 次测验，共做题 {summary.totalQuestions} 题
                    </p>
                    <p className="text-[10px] text-center mt-2" style={{ color: theme.textMuted }}>
                      可截图保存分享给小伙伴~
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Menu */}
      <div className={`px-4 mt-4 ${getAnimationClass(3)}`}>
        <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
          {menuItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                className={`flex items-center justify-between p-4`}
                style={{ borderBottom: i < menuItems.length - 1 ? `1px solid ${theme.border}` : 'none' }}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={item.color} />
                  <span className="text-sm" style={{ color: theme.textPrimary }}>{item.label}</span>
                </div>
                <div className="flex items-center gap-1" style={{ color: theme.textMuted }}>
                  <span className="text-xs">{item.value}</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Incentive Menu */}
      <div className={`px-4 mt-4 ${getAnimationClass(3)}`}>
        <h3 className="font-semibold text-sm mb-3" style={{ color: theme.textPrimary }}>激励中心</h3>
        <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
          {([
            { icon: CalendarCheck, label: '每日签到', desc: `连续${gameState.checkin.streak}天`, color: 'text-orange-500', page: 'checkin' as const },
            { icon: Trophy, label: '我的成就', desc: `${gameState.achievements.filter(a => a.unlocked).length}/${gameState.achievements.length}`, color: 'text-yellow-500', page: 'achievements' as const },
            { icon: ShoppingBag, label: '星币商城', desc: `${user?.totalPoints ?? 0}星币`, color: 'text-purple-500', page: 'shop' as const },
            { icon: Medal, label: '排行榜', desc: '查看排名', color: 'text-blue-500', page: 'ranking' as const },
            { icon: Backpack, label: '背包', desc: `${userState.inventory.items.length}件物品`, color: 'text-emerald-500', page: 'inventory' as const },
            { icon: Mail, label: '邮件', desc: `${userState.mail.mails.filter(m => !m.read).length}未读`, color: 'text-rose-500', page: 'mail' as const, badge: userState.mail.mails.filter(m => !m.read).length },
          ]).map((item, i, arr) => {
            const Icon = item.icon;
            return (
              <button
                key={item.page}
                onClick={() => navigate(item.page)}
                className={`w-full flex items-center justify-between p-4 transition-colors`}
                style={{ 
                  borderBottom: i < arr.length - 1 ? `1px solid ${theme.border}` : 'none',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.bgCard}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={item.color} />
                  <span className="text-sm" style={{ color: theme.textPrimary }}>{item.label}</span>
                </div>
                <div className="flex items-center gap-1" style={{ color: theme.textMuted }}>
                  {item.badge && item.badge > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full">{item.badge}</span>
                  )}
                  <span className="text-xs">{item.desc}</span>
                  <ChevronRight size={14} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Logout */}
      <div className={`px-4 mt-4 mb-4 ${getAnimationClass(4)}`}>
        <button
          onClick={() => userDispatch({ type: 'LOGOUT' })}
          className="w-full rounded-2xl border shadow-sm p-4 flex items-center justify-center gap-2 text-sm"
          style={{ backgroundColor: theme.bgCard, borderColor: theme.border, color: '#ef4444' }}
        >
          <LogOut size={16} />
          退出登录
        </button>
      </div>
    </div>
  );
}
