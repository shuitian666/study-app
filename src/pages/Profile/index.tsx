import { useApp } from '@/store/AppContext';
import { PROFICIENCY_MAP } from '@/types';
import type { ProficiencyLevel } from '@/types';
import { allFrames } from '@/pages/AvatarEdit';
import { Settings, ChevronRight, BookOpen, Award, Star, LogOut, CalendarCheck, Trophy, ShoppingBag, Medal, Backpack, Mail } from 'lucide-react';

export default function ProfilePage() {
  const { state, dispatch, getLearningStats, navigate } = useApp();
  const stats = getLearningStats();
  const user = state.user;
  const isCustomAvatar = user ? (user.avatar?.startsWith('data:') || user.avatar?.startsWith('http')) ?? false : false;

  const profData: { level: ProficiencyLevel; count: number }[] = [
    { level: 'master', count: stats.masteredCount },
    { level: 'normal', count: stats.normalCount },
    { level: 'rusty', count: stats.rustyCount },
    { level: 'none', count: stats.noneCount },
  ];

  const menuItems = [
    { icon: BookOpen, label: '我的学科', value: `${state.subjects.length}个`, color: 'text-blue-500' },
    { icon: Award, label: '测试记录', value: `${stats.totalQuizzes}次`, color: 'text-orange-500' },
    { icon: Star, label: '平均分数', value: `${stats.averageScore}分`, color: 'text-yellow-500' },
  ];

  return (
    <div className="page-scroll pb-4">
      {/* Profile Header - 默认背景是浅色，使用深色文字保证对比度 */}
      <div className="bg-transparent text-text-primary px-5 pt-10 pb-6 relative z-10">
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
            <div>
              <h2 className="text-lg font-bold">{user?.nickname ?? '未登录'}</h2>
              <p className="text-text-muted text-xs">已学习 {stats.streakDays} 天</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('settings')}
            className="p-2 bg-text-primary/10 rounded-full active:bg-text-primary/20 transition-colors"
          >
            <Settings size={18} className="text-text-primary" />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-text-primary/10 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-text-primary">{stats.totalKnowledgePoints}</div>
            <div className="text-[10px] text-text-muted">知识点</div>
          </div>
          <div className="bg-text-primary/10 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-text-primary">{stats.streakDays}</div>
            <div className="text-[10px] text-text-muted">学习天数</div>
          </div>
          <div className="bg-text-primary/10 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-text-primary">{user?.totalPoints ?? 0}</div>
            <div className="text-[10px] text-text-muted">星币</div>
          </div>
        </div>
      </div>

      {/* Learning Profile */}
      <div className="px-4 mt-4">
        <h3 className="font-semibold text-sm mb-3">学习档案</h3>
        <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
          <div className="flex items-center justify-between text-xs text-text-muted mb-3">
            <span>掌握度分布</span>
            <span>共 {stats.totalKnowledgePoints} 个知识点</span>
          </div>

          {/* Stacked bar */}
          <div className="w-full h-4 rounded-full overflow-hidden flex bg-gray-100">
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
                <span className="text-[10px] text-text-muted">{PROFICIENCY_MAP[d.level].label} {d.count}</span>
              </div>
            ))}
          </div>

          {/* Weak subjects */}
          {stats.weakSubjects.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="text-xs text-text-muted mb-1.5">薄弱学科</div>
              <div className="flex flex-wrap gap-1.5">
                {stats.weakSubjects.map(s => (
                  <span key={s} className="bg-red-50 text-red-500 text-xs px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menu */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          {menuItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                className={`flex items-center justify-between p-4 ${i < menuItems.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={item.color} />
                  <span className="text-sm">{item.label}</span>
                </div>
                <div className="flex items-center gap-1 text-text-muted">
                  <span className="text-xs">{item.value}</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Incentive Menu */}
      <div className="px-4 mt-4">
        <h3 className="font-semibold text-sm mb-3">激励中心</h3>
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          {([
            { icon: CalendarCheck, label: '每日签到', desc: `连续${state.checkin.streak}天`, color: 'text-orange-500', page: 'checkin' as const },
            { icon: Trophy, label: '我的成就', desc: `${state.achievements.filter(a => a.unlocked).length}/${state.achievements.length}`, color: 'text-yellow-500', page: 'achievements' as const },
            { icon: ShoppingBag, label: '星币商城', desc: `${user?.totalPoints ?? 0}星币`, color: 'text-purple-500', page: 'shop' as const },
            { icon: Medal, label: '排行榜', desc: '查看排名', color: 'text-blue-500', page: 'ranking' as const },
            { icon: Backpack, label: '背包', desc: `${state.inventory.items.length}件物品`, color: 'text-emerald-500', page: 'inventory' as const },
            { icon: Mail, label: '邮件', desc: `${state.mail.mails.filter(m => !m.read).length}未读`, color: 'text-rose-500', page: 'mail' as const, badge: state.mail.mails.filter(m => !m.read).length },
          ]).map((item, i, arr) => {
            const Icon = item.icon;
            return (
              <button
                key={item.page}
                onClick={() => navigate(item.page)}
                className={`w-full flex items-center justify-between p-4 active:bg-gray-50 transition-colors ${i < arr.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={item.color} />
                  <span className="text-sm">{item.label}</span>
                </div>
                <div className="flex items-center gap-1 text-text-muted">
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
      <div className="px-4 mt-4 mb-4">
        <button
          onClick={() => dispatch({ type: 'LOGOUT' })}
          className="w-full bg-white rounded-2xl border border-border shadow-sm p-4 flex items-center justify-center gap-2 text-danger text-sm"
        >
          <LogOut size={16} />
          退出登录
        </button>
      </div>
    </div>
  );
}
