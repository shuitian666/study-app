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

import type { CSSProperties } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useGame } from '@/store/GameContext';
import { useTheme } from '@/store/ThemeContext';
import { PROFICIENCY_MAP, UILAYOUT_CONFIGS } from '@/types';
import type { ProficiencyLevel, ThemeConfig } from '@/types';
import { allFrames, allTitles, rarityConfig } from '@/data/avatarCatalog';
import { Settings, ChevronRight, BookOpen, Award, Star, LogOut, CalendarCheck, Trophy, ShoppingBag, Medal, Backpack, Mail, FileText } from 'lucide-react';
import { TopAppBar, SettingsList } from '@/components/layout';
import { calculateLearningExperience } from '@/utils/achievementProgress';
import { calculateLevelProgress } from '@/utils/experience';
import { getAdaptivePageBackground, getAdaptiveSurface, isDarkTheme } from '@/utils/adaptiveTheme';
import { accountLogout } from '@/services/aiClient';

function colorWithAlpha(color: string | undefined, opacity: number, fallback: string) {
  if (!color) return fallback;

  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const normalized = hex.length === 3
      ? hex.split('').map(char => char + char).join('')
      : hex;
    const value = Number.parseInt(normalized, 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  const rgba = color.trim().match(/^rgba\(([^)]+)\)$/i);
  if (rgba) {
    const parts = rgba[1].split(',').map(part => part.trim());
    if (parts.length >= 3) return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${opacity})`;
  }

  const rgb = color.trim().match(/^rgb\(([^)]+)\)$/i);
  if (rgb) {
    return `rgba(${rgb[1]}, ${opacity})`;
  }

  return fallback;
}

function getProfilePageBackground(theme: ThemeConfig): CSSProperties {
  const dark = isDarkTheme(theme);
  const base = getAdaptivePageBackground(theme);
  const topGlow = colorWithAlpha(theme.primaryFixed || theme.primary, dark ? 0.32 : 0.28, 'rgba(255, 255, 255, 0.28)');
  const topWash = colorWithAlpha(theme.surfaceContainerLow || theme.bg, dark ? 0.62 : 0.78, theme.bg);

  return {
    ...base,
    background: dark
      ? `radial-gradient(circle at 50% -12%, ${topGlow} 0%, transparent 38%), linear-gradient(180deg, ${topWash} 0%, ${theme.bg} 48%, ${theme.bg} 100%)`
      : `linear-gradient(180deg, ${topGlow} 0%, ${topWash} 34%, ${theme.bg} 100%)`,
  };
}

function getProfilePanelStyle(theme: ThemeConfig, level: 'primary' | 'raised' = 'raised'): CSSProperties {
  const dark = isDarkTheme(theme);
  const fallbackSurface = dark ? 'rgba(17, 27, 45, 0.74)' : 'rgba(255, 255, 255, 0.72)';
  const backgroundColor = colorWithAlpha(
    level === 'primary' ? theme.bgCard : theme.surfaceContainerLowest || theme.bgCard,
    dark ? 0.72 : 0.76,
    fallbackSurface,
  );

  return {
    backgroundColor,
    borderColor: colorWithAlpha(theme.border, dark ? 0.34 : 0.42, dark ? 'rgba(148, 163, 184, 0.28)' : 'rgba(148, 163, 184, 0.30)'),
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
  };
}

function getProfileInsetStyle(theme: ThemeConfig): CSSProperties {
  const dark = isDarkTheme(theme);
  return {
    backgroundColor: colorWithAlpha(theme.surfaceContainerLow || theme.bgCard, dark ? 0.68 : 0.62, dark ? 'rgba(30, 41, 59, 0.58)' : 'rgba(248, 250, 252, 0.62)'),
    borderColor: colorWithAlpha(theme.border, dark ? 0.28 : 0.34, dark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(148, 163, 184, 0.24)'),
  };
}

function getProfileHeroBackground(theme: ThemeConfig): string {
  const dark = isDarkTheme(theme);
  const glow = colorWithAlpha(theme.primaryFixed || theme.primary, dark ? 0.30 : 0.34, 'rgba(222, 224, 255, 0.34)');
  const fade = colorWithAlpha(theme.bg, dark ? 0.58 : 0.74, theme.bg);
  return `linear-gradient(180deg, ${glow} 0%, ${fade} 78%, transparent 100%)`;
}

export default function ProfilePage() {
  const { userState, userDispatch, navigate } = useUser();
  const { learningState, getLearningStats } = useLearning();
  const { gameState } = useGame();
  const { theme } = useTheme();
  const stats = getLearningStats();
  const user = userState.user;
  const learningExperience = calculateLearningExperience(learningState, gameState.checkin) + (user?.bonusExperience ?? 0);
  const levelProgress = calculateLevelProgress(learningExperience);
  const isCustomAvatar = user ? (user.avatar?.startsWith('data:') || user.avatar?.startsWith('http')) ?? false : false;

  const uiStyle = theme.uiStyle || 'playful';
  const layoutConfig = UILAYOUT_CONFIGS[uiStyle];
  const profilePageStyle = getProfilePageBackground(theme);
  const profilePrimaryPanelStyle = getProfilePanelStyle(theme, 'primary');
  const profileRaisedPanelStyle = getProfilePanelStyle(theme);
  const profileInsetStyle = getProfileInsetStyle(theme);
  const profileSoftDivider = colorWithAlpha(theme.border, isDarkTheme(theme) ? 0.30 : 0.38, theme.border);

  const getAnimationClass = (delay: number) => {
    if (layoutConfig.animationStyle === 'simple') return '';
    return `scroll-slide-up reveal-delay-${delay}`;
  };

  // 当前称号
  const activeTitle = allTitles.find(t => t.id === user?.activeTitle);
  const currentTitle = activeTitle && userState.inventory.items.some(item => item.type === 'title' && item.name === activeTitle.name)
    ? activeTitle
    : null;

  const handleLogout = async () => {
    try {
      await accountLogout();
    } catch (err) {
      console.warn('Failed to clear server session:', err);
    } finally {
      userDispatch({ type: 'LOGOUT' });
    }
  };

  const profData: { level: ProficiencyLevel; count: number }[] = [
    { level: 'master', count: stats.masteredCount },
    { level: 'normal', count: stats.normalCount },
    { level: 'rusty', count: stats.rustyCount },
    { level: 'none', count: stats.noneCount },
  ];

  // ===== Scholar 风格渲染 =====
  if (uiStyle === 'scholar') {
    return (
      <div className="page-scroll" style={profilePageStyle}>
        <TopAppBar />

        {/* ── Hero Banner ── */}
        <div
          className="relative overflow-hidden px-6 pt-5 pb-8"
          style={{
            background: getProfileHeroBackground(theme),
          }}
        >
          <div className="flex flex-col items-center text-center gap-3">
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
                      className="w-24 h-24 rounded-full flex items-center justify-center"
                      style={{
                        background: frameConfig.gradient,
                        clipPath: frameConfig.shapeTransform || 'circle(50%)',
                      }}
                    >
                      <div className="rounded-full flex items-center justify-center p-1 w-[calc(100%-8px)] h-[calc(100%-8px)]" style={getAdaptiveSurface(theme, 'raised')}>
                        {isCustomAvatar ? (
                          <img src={user.avatar} alt="头像" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <span className="text-3xl">{user?.avatar || '👤'}</span>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden border-[3px] shadow-lg"
                  style={{
                    backgroundColor: profileInsetStyle.backgroundColor,
                    borderColor: colorWithAlpha(theme.primaryFixed || theme.border, 0.46, `${theme.primaryFixed || '#dee0ff'}cc`),
                  }}
                >
                  {isCustomAvatar && user?.avatar ? (
                    <img src={user.avatar} alt="头像" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">{user?.avatar || '👤'}</span>
                  )}
                </div>
              )}
              <div
                className="absolute bottom-0.5 right-0.5 p-1.5 rounded-full shadow-md"
                style={{ backgroundColor: theme.primary }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
            </button>

            {/* Name & Title */}
            <div>
              <h1
                className="text-xl font-extrabold"
                style={{ color: theme.onSurface || '#191c1d', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
              >
                {user?.nickname ?? '未登录'}
              </h1>
              {currentTitle && (
                <span
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full font-medium mt-1.5"
                  style={{
                    background: currentTitle.gradient,
                    color: currentTitle.textColor,
                  }}
                >
                  <span>{currentTitle.icon}</span>
                  <span>{currentTitle.name}</span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                    style={{ backgroundColor: 'rgba(255,255,255,0.55)', color: rarityConfig[currentTitle.rarity].color }}
                  >
                    {currentTitle.rarity}
                  </span>
                </span>
              )}
              <div className="mx-auto mt-3 w-56 max-w-full">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                    style={{
                      backgroundColor: theme.primaryFixed || '#dee0ff',
                      color: theme.primary || '#24389c',
                    }}
                  >
                    Level {levelProgress.level}
                  </span>
                  <span className="text-xs" style={{ color: theme.onSurfaceVariant || '#454652' }}>
                    {levelProgress.currentLevelExp}/{levelProgress.nextLevelExp} EXP
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: theme.surfaceContainerHigh || '#e7e8e9' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${levelProgress.progressPercent}%`, backgroundColor: theme.primary || '#24389c' }}
                  />
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div
              className="flex items-center w-full max-w-xs rounded-2xl overflow-hidden"
              style={{
                backgroundColor: profilePrimaryPanelStyle.backgroundColor,
                border: `1px solid ${colorWithAlpha(theme.outlineVariant || theme.border, 0.34, `${theme.outlineVariant || '#c5c5d4'}44`)}`,
                backdropFilter: 'blur(8px)',
              }}
            >
              <div className="flex-1 text-center py-3">
                <p
                  className="text-lg font-extrabold leading-none"
                  style={{ color: theme.primary || '#24389c', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  {stats.streakDays}
                </p>
                <p className="text-[10px] mt-1" style={{ color: theme.onSurfaceVariant || '#454652' }}>连续天数</p>
              </div>
              <div className="w-px self-stretch my-2" style={{ backgroundColor: profileSoftDivider }} />
              <div className="flex-1 text-center py-3">
                <p
                  className="text-lg font-extrabold leading-none"
                  style={{ color: theme.primary || '#24389c', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  {stats.totalKnowledgePoints}
                </p>
                <p className="text-[10px] mt-1" style={{ color: theme.onSurfaceVariant || '#454652' }}>知识点</p>
              </div>
              <div className="w-px self-stretch my-2" style={{ backgroundColor: profileSoftDivider }} />
              <div className="flex-1 text-center py-3">
                <p
                  className="text-lg font-extrabold leading-none"
                  style={{ color: theme.primary || '#24389c', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  {learningExperience}
                </p>
                <p className="text-[10px] mt-1" style={{ color: theme.onSurfaceVariant || '#454652' }}>经验值</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="px-6 pb-10 space-y-4">

          {/* Learning Profile */}
          <div
            className="p-5 rounded-2xl"
            style={{
              ...profileRaisedPanelStyle,
              border: `1px solid ${profileRaisedPanelStyle.borderColor}`,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold" style={{ color: theme.onSurface || '#191c1d' }}>掌握度分布</span>
              <span className="text-xs" style={{ color: theme.onSurfaceVariant || '#454652' }}>共 {stats.totalKnowledgePoints} 个知识点</span>
            </div>

            {/* Stacked bar */}
            <div className="w-full h-3 rounded-full overflow-hidden flex" style={{ backgroundColor: theme.surfaceContainerHigh || '#e7e8e9' }}>
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

            <div className="grid grid-cols-4 gap-1 mt-4">
              {profData.map(d => (
                <div key={d.level} className="flex flex-col items-center gap-0.5">
                  <div className="w-2 h-2 rounded-full mb-0.5" style={{ backgroundColor: PROFICIENCY_MAP[d.level].color }} />
                  <span className="text-[10px]" style={{ color: theme.onSurfaceVariant || '#454652' }}>
                    {PROFICIENCY_MAP[d.level].label}
                  </span>
                  <span className="text-sm font-bold" style={{ color: theme.onSurface || '#191c1d' }}>
                    {d.count}
                  </span>
                </div>
              ))}
            </div>

            {stats.weakSubjects.length > 0 && (
              <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${theme.outlineVariant || '#c5c5d4'}25` }}>
                <div className="text-xs font-medium mb-2" style={{ color: theme.onSurfaceVariant || '#454652' }}>薄弱学科</div>
                <div className="flex flex-wrap gap-1.5">
                  {stats.weakSubjects.map(s => (
                    <span
                      key={s}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${theme.error || '#ba1a1a'}12`, color: theme.error || '#ba1a1a' }}
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
            title="功能入口"
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
                value: `${userState.inventory.items.length}件物品`,
                onClick: () => navigate('inventory'),
              },
              {
                key: 'ai-study-summaries',
                icon: <FileText size={20} />,
                iconColor: 'text-indigo-500',
                label: '学习总结',
                value: '历史建议',
                onClick: () => navigate('ai-study-summaries'),
              },
              {
                key: 'mail',
                icon: <Mail size={20} />,
                iconColor: 'text-rose-500',
                label: '邮件',
                badge: userState.mail.mails.filter(m => !m.read).length,
                onClick: () => navigate('mail'),
              },
            ]}
          />

          {/* Logout */}
          <button
            onClick={() => { void handleLogout(); }}
            className="w-full py-3.5 text-center rounded-2xl font-semibold text-sm transition-colors"
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
    <div className="page-scroll pb-4 pt-2" style={profilePageStyle}>
      <div
        className="mx-4 mt-2 rounded-2xl border px-5 pt-5 pb-5 shadow-[0_14px_34px_-26px_rgba(15,23,42,0.45)] backdrop-blur-xl"
        style={{
          ...profilePrimaryPanelStyle,
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
                      <div className="rounded-full flex items-center justify-center p-1 w-[calc(100%-8px)] h-[calc(100%-8px)]" style={getAdaptiveSurface(theme, 'raised')}>
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
                  style={{ ...profileInsetStyle, border: `1px solid ${profileInsetStyle.borderColor}` }}
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
              <h2 className="text-lg font-bold" style={{ color: theme.textPrimary }}>{user?.nickname ?? '未登录'}</h2>
              {currentTitle && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 self-start" style={{
                  background: currentTitle.gradient,
                  color: currentTitle.textColor
                }}>
                  <span>{currentTitle.icon}</span>
                  <span>{currentTitle.name}</span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                    style={{ backgroundColor: 'rgba(255,255,255,0.55)', color: rarityConfig[currentTitle.rarity].color }}
                  >
                    {currentTitle.rarity}
                  </span>
                </span>
              )}
              <div className="mt-1.5 w-40 max-w-full">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ backgroundColor: `${theme.primary}14`, color: theme.primary }}
                  >
                    Lv. {levelProgress.level}
                  </span>
                  <span className="text-[10px]" style={{ color: theme.textMuted }}>
                    {levelProgress.currentLevelExp}/{levelProgress.nextLevelExp} EXP
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full" style={{ backgroundColor: theme.border }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${levelProgress.progressPercent}%`, backgroundColor: theme.secondary }}
                  />
                </div>
              </div>
              <p className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>已学习 {stats.streakDays} 天</p>
            </div>
          </div>
          <button
            onClick={() => navigate('settings')}
            className="rounded-full p-2 transition-colors active:opacity-70"
            style={{ ...profileInsetStyle, border: `1px solid ${profileInsetStyle.borderColor}` }}
          >
            <Settings size={18} style={{ color: theme.textSecondary }} />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ ...profileInsetStyle, border: `1px solid ${profileInsetStyle.borderColor}` }}>
            <div className="text-xl font-bold" style={{ color: theme.primary }}>{stats.totalKnowledgePoints}</div>
            <div className="text-[10px]" style={{ color: theme.textSecondary }}>知识点</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ ...profileInsetStyle, border: `1px solid ${profileInsetStyle.borderColor}` }}>
            <div className="text-xl font-bold" style={{ color: theme.primary }}>{stats.streakDays}</div>
            <div className="text-[10px]" style={{ color: theme.textSecondary }}>学习天数</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ ...profileInsetStyle, border: `1px solid ${profileInsetStyle.borderColor}` }}>
            <div className="text-xl font-bold" style={{ color: theme.secondary }}>{user?.totalPoints ?? 0}</div>
            <div className="text-[10px]" style={{ color: theme.textSecondary }}>星币</div>
          </div>
        </div>
      </div>

      {/* Learning Profile */}
      <div className={`px-4 mt-4 ${getAnimationClass(1)}`}>
        <h3 className="font-semibold text-sm mb-3" style={{ color: theme.textPrimary }}>学习档案</h3>
        <div className="rounded-2xl p-4 border shadow-sm backdrop-blur-xl" style={profileRaisedPanelStyle}>
          <div className="flex items-center justify-between text-xs mb-3" style={{ color: theme.textSecondary }}>
            <span>掌握度分布</span>
            <span>共 {stats.totalKnowledgePoints} 个知识点</span>
          </div>

          <div className="w-full h-4 rounded-full overflow-hidden flex" style={{ backgroundColor: profileSoftDivider }}>
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
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${profileSoftDivider}` }}>
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
        <div className="rounded-2xl border shadow-sm overflow-hidden backdrop-blur-xl" style={profileRaisedPanelStyle}>
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
                style={{ borderBottom: i < arr.length - 1 ? `1px solid ${profileSoftDivider}` : 'none' }}
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
        <div className="rounded-2xl border shadow-sm overflow-hidden backdrop-blur-xl" style={profileRaisedPanelStyle}>
          {([
            { icon: CalendarCheck, label: '每日签到', desc: `连续${gameState.checkin.streak}天`, color: 'text-orange-500', page: 'checkin' as const },
            { icon: Trophy, label: '我的成就', desc: `${gameState.achievements.filter(a => a.unlocked).length}/${gameState.achievements.length}`, color: 'text-yellow-500', page: 'achievements' as const },
            { icon: ShoppingBag, label: '星币商城', desc: `${user?.totalPoints ?? 0}星币`, color: 'text-purple-500', page: 'shop' as const },
            { icon: Medal, label: '排行榜', desc: '查看排名', color: 'text-blue-500', page: 'ranking' as const },
            { icon: Backpack, label: '背包', desc: `${userState.inventory.items.length}件物品`, color: 'text-emerald-500', page: 'inventory' as const },
            { icon: FileText, label: '学习总结', desc: '复盘与建议', color: 'text-indigo-500', page: 'ai-study-summaries' as const },
            { icon: Mail, label: '邮件', desc: `${userState.mail.mails.filter(m => !m.read).length}未读`, color: 'text-rose-500', page: 'mail' as const, badge: userState.mail.mails.filter(m => !m.read).length },
          ]).map((item, i, arr) => {
            const Icon = item.icon;
            return (
              <button
                key={item.page}
                onClick={() => navigate(item.page)}
                className={`w-full flex items-center justify-between p-4 transition-colors`}
                style={{
                  borderBottom: i < arr.length - 1 ? `1px solid ${profileSoftDivider}` : 'none',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colorWithAlpha(theme.bgCard, isDarkTheme(theme) ? 0.54 : 0.58, theme.bgCard)}
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
          onClick={() => { void handleLogout(); }}
          className="w-full rounded-2xl border shadow-sm p-4 flex items-center justify-center gap-2 text-sm backdrop-blur-xl"
          style={{ ...profileRaisedPanelStyle, color: '#ef4444' }}
        >
          <LogOut size={16} />
          退出登录
        </button>
      </div>
    </div>
  );
}
