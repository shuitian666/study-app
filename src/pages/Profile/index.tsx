/**
 * ============================================================================
 * 个人资料页面 (Profile Page)
 * ============================================================================
 *
 * 【双风格布局】
 *
 * 【Playful 风格】
 * - 渐变头部：头像 + 昵称 + 称号 + 统计数据
 * - 学习档案：掌握度分布
 * - 学习总结：周/月总结按钮
 * - 菜单列表：图标 + 文字
 * - 激励中心：图标列表
 *
 * 【Scholar 风格 - Fluid Scholar 设计系统】
 * - TopAppBar 顶部导航栏
 * - 居中头像 + 昵称布局
 * - Bento Grid 统计卡片
 * - iOS 风格设置列表
 * - 简化称号显示（无 emoji）
 * ============================================================================
 */

import { useEffect, useState } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useGame } from '@/store/GameContext';
import { useTheme } from '@/store/ThemeContext';
import { PROFICIENCY_MAP, UILAYOUT_CONFIGS } from '@/types';
import type { ProficiencyLevel } from '@/types';
import { allFrames, allTitles } from '@/pages/AvatarEdit';
import { Settings, ChevronRight, BookOpen, Award, Star, LogOut, CalendarCheck, Trophy, ShoppingBag, Medal, Backpack, Mail, Coins } from 'lucide-react';
import { TopAppBar, SettingsList } from '@/components/layout';

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

  const uiStyle = theme.uiStyle || 'playful';
  const layoutConfig = UILAYOUT_CONFIGS[uiStyle];

  // 动画效果
  const [animationEffect, setAnimationEffect] = useState(() => {
    const saved = localStorage.getItem('main-animation-effect');
    return saved || 'slide-up';
  });

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'main-animation-effect' && e.newValue) {
        setAnimationEffect(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const getAnimationClass = (delay: number) => {
    if (layoutConfig.animationStyle === 'simple') return '';
    const baseClass = `scroll-${animationEffect}`;
    const delayClass = `reveal-delay-${delay}`;
    return `${baseClass} ${delayClass}`;
  };

  // 当前称号
  const currentTitle = allTitles.find(t => t.id === user?.activeTitle);

  const profData: { level: ProficiencyLevel; count: number }[] = [
    { level: 'master', count: stats.masteredCount },
    { level: 'normal', count: stats.normalCount },
    { level: 'rusty', count: stats.rustyCount },
    { level: 'none', count: stats.noneCount },
  ];

  // ===== Scholar 风格渲染 =====
  if (uiStyle === 'scholar') {
    return (
      <div className="page-scroll" style={{ backgroundColor: theme.bg || '#f8f9fa' }}>
        <TopAppBar />

        <div className="px-6 py-8 space-y-6 max-w-2xl mx-auto">
          {/* Profile Header - Centered */}
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Avatar */}
            <button
              onClick={() => navigate('avatar-edit')}
              className="relative"
            >
              {user?.avatarFrame ? (
                (() => {
                  const frameConfig = allFrames.find(f => f.icon === user.avatarFrame);
                  if (!frameConfig) return null;
                  return (
                    <div
                      className="w-32 h-32 rounded-full flex items-center justify-center"
                      style={{
                        background: frameConfig.gradient,
                        clipPath: frameConfig.shapeTransform || 'circle(50%)',
                      }}
                    >
                      <div className="bg-white/40 rounded-full flex items-center justify-center p-1 w-[calc(100%-8px)] h-[calc(100%-8px)]">
                        {isCustomAvatar ? (
                          <img src={user.avatar} alt="头像" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <span className="text-4xl">{user?.avatar || '👤'}</span>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div
                  className="w-32 h-32 rounded-full flex items-center justify-center overflow-hidden border-4 border-white shadow-xl"
                  style={{ backgroundColor: theme.surfaceContainerHigh || '#e7e8e9' }}
                >
                  {isCustomAvatar && user?.avatar ? (
                    <img src={user.avatar} alt="头像" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl">{user?.avatar || '👤'}</span>
                  )}
                </div>
              )}
              <div
                className="absolute bottom-1 right-1 p-2 rounded-full shadow-lg"
                style={{ backgroundColor: theme.primary }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
            </button>

            {/* Name & Title */}
            <div>
              <h1
                className="text-2xl font-extrabold"
                style={{ color: theme.onSurface || '#191c1d', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
              >
                {user?.nickname ?? '未登录'}
              </h1>
              {currentTitle && (
                <span
                  className="inline-block text-xs px-3 py-1 rounded-full font-medium mt-2"
                  style={{
                    background: currentTitle.gradient,
                    color: currentTitle.textColor
                  }}
                >
                  {currentTitle.name}
                </span>
              )}
              <p className="text-sm mt-1" style={{ color: theme.onSurfaceVariant || '#454652' }}>
                已学习 {stats.streakDays} 天
              </p>
            </div>

            {/* Edit Profile Button */}
            <button
              onClick={() => navigate('settings')}
              className="px-8 py-3 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-95 transition-all"
              style={{
                backgroundColor: theme.primary,
                color: theme.onPrimary || '#ffffff',
                boxShadow: '0 4px 12px -2px rgba(36, 56, 156, 0.25)',
              }}
            >
              编辑个人资料
            </button>
          </div>

          {/* Learning Statistics - Bento Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Learning Time - Wider */}
            <div
              className="col-span-2 p-6 rounded-2xl relative overflow-hidden"
              style={{
                backgroundColor: theme.primaryFixed || '#dee0ff',
                boxShadow: 'none',
              }}
            >
              <div
                className="absolute -right-4 -top-4 opacity-10"
                style={{ transform: 'rotate(15deg)' }}
              >
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke={theme.primary} strokeWidth="1">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: theme.primary || '#24389c' }}
              >
                学习总时长
              </span>
              <div className="mt-auto">
                <span
                  className="text-4xl font-black"
                  style={{ color: theme.primary || '#24389c', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  128
                </span>
                <span
                  className="text-lg font-medium ml-1"
                  style={{ color: theme.primary || '#24389c', opacity: 0.7 }}
                >
                  小时
                </span>
              </div>
            </div>

            {/* Rank */}
            <div
              className="p-6 rounded-2xl"
              style={{
                backgroundColor: theme.secondaryFixed || '#ffdfa0',
                boxShadow: 'none',
              }}
            >
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: theme.onSecondaryFixedVariant || '#5c4300' }}
              >
                当前排名
              </span>
              <div className="mt-auto">
                <span
                  className="text-4xl font-black"
                  style={{ color: theme.onSecondaryFixed || '#261a00', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  #42
                </span>
                <p className="text-xs mt-1" style={{ color: theme.onSecondaryFixedVariant || '#5c4300', opacity: 0.8 }}>
                  全校领先 5%
                </p>
              </div>
            </div>

            {/* XP */}
            <div
              className="p-6 rounded-2xl"
              style={{
                backgroundColor: theme.surfaceContainerLowest || '#ffffff',
                boxShadow: 'none',
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: theme.tertiaryFixed || '#fdd6ff' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.tertiary || '#73008e'} strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.onSurfaceVariant || '#454652' }}>
                  经验值 (XP)
                </p>
                <p className="text-2xl font-black" style={{ color: theme.onSurface || '#191c1d', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  {user?.totalPoints ?? 0}
                </p>
                <p className="text-xs mt-1" style={{ color: theme.tertiary || '#73008e' }}>
                  距离升级还需 550 XP
                </p>
              </div>
            </div>
          </div>

          {/* Learning Profile */}
          <div
            className="p-6 rounded-2xl"
            style={{
              backgroundColor: theme.surfaceContainerLowest || '#ffffff',
              boxShadow: 'none',
            }}
          >
            <div className="flex items-center justify-between text-xs mb-3">
              <span style={{ color: theme.onSurfaceVariant || '#454652' }}>掌握度分布</span>
              <span style={{ color: theme.onSurfaceVariant || '#454652' }}>共 {stats.totalKnowledgePoints} 个知识点</span>
            </div>

            {/* Stacked bar */}
            <div className="w-full h-1.5 rounded-full overflow-hidden flex" style={{ backgroundColor: theme.surfaceContainerHigh || '#e7e8e9' }}>
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

            <div className="grid grid-cols-4 gap-2 mt-4">
              {profData.map(d => (
                <div key={d.level} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PROFICIENCY_MAP[d.level].color }} />
                  <span className="text-xs" style={{ color: theme.onSurfaceVariant || '#454652' }}>
                    {PROFICIENCY_MAP[d.level].label} {d.count}
                  </span>
                </div>
              ))}
            </div>

            {stats.weakSubjects.length > 0 && (
              <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${theme.outlineVariant || '#c5c5d4'}15` }}>
                <div className="text-xs mb-2" style={{ color: theme.onSurfaceVariant || '#454652' }}>薄弱学科</div>
                <div className="flex flex-wrap gap-2">
                  {stats.weakSubjects.map(s => (
                    <span
                      key={s}
                      className="text-xs px-2 py-1 rounded-full"
                      style={{ backgroundColor: `${theme.error || '#ba1a1a'}15`, color: theme.error || '#ba1a1a' }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Settings List - iOS Style */}
          <SettingsList
            title="应用设置"
            items={[
              {
                key: 'checkin',
                icon: <CalendarCheck size={20} />,
                iconColor: 'text-orange-500',
                label: '每日签到',
                value: `连续${gameState.checkin.streak}天`,
                onClick: () => navigate('checkin'),
              },
              {
                key: 'achievements',
                icon: <Trophy size={20} />,
                iconColor: 'text-yellow-500',
                label: '我的成就',
                value: `${gameState.achievements.filter(a => a.unlocked).length}/${gameState.achievements.length}`,
                onClick: () => navigate('achievements'),
              },
              {
                key: 'shop',
                icon: <ShoppingBag size={20} />,
                iconColor: 'text-purple-500',
                label: '星币商城',
                value: `${user?.totalPoints ?? 0}星币`,
                onClick: () => navigate('shop'),
              },
              {
                key: 'ranking',
                icon: <Medal size={20} />,
                iconColor: 'text-blue-500',
                label: '排行榜',
                onClick: () => navigate('ranking'),
              },
              {
                key: 'inventory',
                icon: <Backpack size={20} />,
                iconColor: 'text-emerald-500',
                label: '背包',
                value: `${gameState.inventory.items.length}件物品`,
                onClick: () => navigate('inventory'),
              },
              {
                key: 'mail',
                icon: <Mail size={20} />,
                iconColor: 'text-rose-500',
                label: '邮件',
                badge: gameState.mail.mails.filter(m => !m.read).length,
                onClick: () => navigate('mail'),
              },
            ]}
          />

          {/* Logout */}
          <button
            onClick={() => userDispatch({ type: 'LOGOUT' })}
            className="w-full py-4 text-center rounded-2xl font-bold text-sm transition-colors"
            style={{
              backgroundColor: `${theme.error || '#ba1a1a'}10`,
              color: theme.error || '#ba1a1a',
            }}
          >
            退出登录
          </button>
        </div>
      </div>
    );
  }

  // ===== Playful 风格渲染（保持原有样式）=====
  return (
    <div className="page-scroll pb-4">
      {/* Profile Header - 渐变背景 */}
      <div
        className="text-white px-5 pt-16 pb-8 rounded-b-[40px] overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* 头像区域 */}
            <button
              onClick={() => navigate('avatar-edit')}
              className="relative"
            >
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
                      <div className="bg-white/40 rounded-full flex items-center justify-center p-1 w-[calc(100%-8px)] h-[calc(100%-8px)]">
                        {isCustomAvatar ? (
                          <img src={user.avatar} alt="头像" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <span className="text-2xl">{user?.avatar || '👤'}</span>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                  style={{ backgroundColor: 'rgba(255,255,255,0.4)' }}
                >
                  {isCustomAvatar && user?.avatar ? (
                    <img src={user.avatar} alt="头像" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    user?.avatar || '👤'
                  )}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-white text-[8px]">
                ✎
              </div>
            </button>
            <div className="flex flex-col">
              <h2 className="text-lg font-bold" style={{ color: '#ffffff' }}>{user?.nickname ?? '未登录'}</h2>
              {currentTitle && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 self-start" style={{
                  background: currentTitle.gradient,
                  color: currentTitle.textColor
                }}>
                  {currentTitle.icon} {currentTitle.name}
                </span>
              )}
              <p className="text-xs mt-0.5" style={{ color: '#ffffff' }}>已学习 {stats.streakDays} 天</p>
            </div>
          </div>
          <button
            onClick={() => navigate('settings')}
            className="p-2 bg-white/20 rounded-full active:bg-white/30 transition-colors"
          >
            <Settings size={18} style={{ color: '#ffffff' }} />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <div className="text-xl font-bold" style={{ color: '#ffffff' }}>{stats.totalKnowledgePoints}</div>
            <div className="text-[10px]" style={{ color: '#ffffff' }}>知识点</div>
          </div>
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <div className="text-xl font-bold" style={{ color: '#ffffff' }}>{stats.streakDays}</div>
            <div className="text-[10px]" style={{ color: '#ffffff' }}>学习天数</div>
          </div>
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <div className="text-xl font-bold" style={{ color: '#ffffff' }}>{user?.totalPoints ?? 0}</div>
            <div className="text-[10px]" style={{ color: '#ffffff' }}>星币</div>
          </div>
        </div>
      </div>

      {/* Learning Profile */}
      <div className={`px-4 mt-4 ${getAnimationClass(1)}`}>
        <h3 className="font-semibold text-sm mb-3" style={{ color: theme.textPrimary }}>学习档案</h3>
        <div className="rounded-2xl p-4 border shadow-sm" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
          <div className="flex items-center justify-between text-xs mb-3" style={{ color: theme.textSecondary }}>
            <span>掌握度分布</span>
            <span>共 {stats.totalKnowledgePoints} 个知识点</span>
          </div>

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
                <span className="text-[10px]" style={{ color: theme.textSecondary }}>{PROFICIENCY_MAP[d.level].label} {d.count}</span>
              </div>
            ))}
          </div>

          {stats.weakSubjects.length > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${theme.border}` }}>
              <div className="text-xs mb-1.5" style={{ color: theme.textSecondary }}>薄弱学科</div>
              <div className="flex flex-wrap gap-1.5">
                {stats.weakSubjects.map(s => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menu */}
      <div className={`px-4 mt-4 ${getAnimationClass(3)}`}>
        <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
          {([
            { icon: BookOpen, label: '我的学科', value: `${learningState.subjects.length}个`, color: 'text-blue-500' },
            { icon: Award, label: '测试记录', value: `${stats.totalQuizzes}次`, color: 'text-orange-500' },
            { icon: Star, label: '平均分数', value: `${stats.averageScore}分`, color: 'text-yellow-500' },
          ] as const).map((item, i, arr) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                className={`flex items-center justify-between p-4`}
                style={{ borderBottom: i < arr.length - 1 ? `1px solid ${theme.border}` : 'none' }}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={item.color} />
                  <span className="text-sm" style={{ color: theme.textPrimary }}>{item.label}</span>
                </div>
                <div className="flex items-center gap-1" style={{ color: theme.textSecondary }}>
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
            { icon: Coins, label: '星币账单', desc: '查看收支记录', color: 'text-amber-500', page: 'coin-bill' as const },
            { icon: Medal, label: '排行榜', desc: '查看排名', color: 'text-blue-500', page: 'ranking' as const },
            { icon: Backpack, label: '背包', desc: `${gameState.inventory.items.length}件物品`, color: 'text-emerald-500', page: 'inventory' as const },
            { icon: Mail, label: '邮件', desc: `${gameState.mail.mails.filter(m => !m.read).length}未读`, color: 'text-rose-500', page: 'mail' as const, badge: gameState.mail.mails.filter(m => !m.read).length },
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
                <div className="flex items-center gap-1" style={{ color: theme.textSecondary }}>
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
