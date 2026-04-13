/**
 * ============================================================================
 * 首页 (Home Page)
 * ============================================================================
 *
 * 【双风格布局】
 *
 * 【Playful 风格】
 * 1. 渐变头部：问候语 + 用户昵称 + 连续学习天数 + AI 鼓励语
 * 2. 今日学习任务卡片：2列任务
 * 3. 学习总览：掌握度分布条 + 四级统计
 * 4. 每日福利：4宫格快捷入口
 * 5. 快速开始：emoji + 2x3网格
 *
 * 【Scholar 风格 - Fluid Scholar 设计系统】
 * 1. TopAppBar 顶部导航栏
 * 2. 问候区 + 连续学习天数
 * 3. Bento Grid 布局（今日任务、统计、AI Banner）
 * 4. 快捷入口（Material Icons）
 * 5. Floating AI Button
 * ============================================================================
 */

import { useEffect, useState } from 'react';
import { useApp } from '@/store/AppContext';
import { useLearning } from '@/store/LearningContext';
import { useGame } from '@/store/GameContext';
import { useUser } from '@/store/UserContext';
import { useTheme } from '@/store/ThemeContext';
import { generateTodayReviewPlan, getGreeting, getEncouragement } from '@/utils/review';
import { getSmartEncouragement } from '@/services/aiService';
import { PROFICIENCY_MAP, UILAYOUT_CONFIGS } from '@/types';
import type { ProficiencyLevel } from '@/types';
import { Brain, Target, TrendingUp, ChevronRight, Sparkles, CalendarCheck, Trophy, ShoppingBag, Medal, Bot, Play, CheckCircle, BookOpen, Map, FileQuestion, Zap } from 'lucide-react';
import { ProgressBar } from '@/components/ui/Common';
import { TopAppBar, FloatingAIPanel } from '@/components/layout';

export default function HomePage() {

  const { state: appState, dispatch: appDispatch, getLearningStats } = useApp();
  const { learningState, learningDispatch } = useLearning();
  const { gameState } = useGame();
  const { navigate } = useUser();
  const { theme } = useTheme();
  const stats = getLearningStats();

  const uiStyle = theme.uiStyle || 'playful';
  const layoutConfig = UILAYOUT_CONFIGS[uiStyle];

  // 本地缓存鼓励语，避免每次渲染随机变化
  const [fallbackEncouragement] = useState(() => getEncouragement());

  // 动画效果 - playful 风格使用动画
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

  // 生成今日复习计划
  useEffect(() => {
    const { review, newItems } = generateTodayReviewPlan(learningState.knowledgePoints, learningState.todayNewItems);
    learningDispatch({ type: 'SET_REVIEW_ITEMS', payload: { review, newItems } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Daily smart encouragement
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (appState.dailyEncouragementDate !== today) {
      getSmartEncouragement(stats, learningState.wrongRecords.length, gameState.checkin.streak)
        .then(text => {
          appDispatch({ type: 'SET_DAILY_ENCOURAGEMENT', payload: { text, date: today } });
        })
        .catch(() => {});
    }
  }, [appState.dailyEncouragementDate, learningState.wrongRecords.length, gameState.checkin.streak, appDispatch]);

  const encouragementText = appState.dailyEncouragement ?? fallbackEncouragement;

  // 学习数据
  const reviewPending = learningState.todayReviewItems.filter(r => !r.completed).length;
  const completedNew = learningState.todayNewItems.filter(r => r.completed).length;
  const dailyNewGoal = appState.user?.dailyNewGoal ?? 15;
  const reviewCompleted = reviewPending === 0;
  const newGoalCompleted = completedNew >= dailyNewGoal;
  const hasPendingNew = learningState.todayNewItems.filter(r => !r.completed).length > 0;
  const freeLearningMode = reviewCompleted && newGoalCompleted && hasPendingNew;
  const todayGoal = appState.user?.dailyGoal ?? 10;
  const todayQuestions = appState.user?.todayQuestions ?? 0;
  const todayProgress = Math.min(100, Math.round((todayQuestions / Math.max(todayGoal, 1)) * 100));
  const reviewTotal = learningState.todayReviewItems.length;

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
        {/* TopAppBar */}
        <TopAppBar />

        <div className="px-6 pt-6 space-y-6 pb-32">
          {/* Greeting Section */}
          <div className="flex items-end justify-between">
            <div>
              <h2
                className="text-3xl font-bold mb-1"
                style={{ color: theme.textPrimary, fontFamily: 'Plus Jakarta Sans, sans-serif' }}
              >
                {getGreeting()}, {appState.user?.nickname ?? '同学'}
              </h2>
              <p className="text-sm" style={{ color: theme.textSecondary }}>今天又是进步的一天。</p>
            </div>
            <div
              className="px-4 py-2 rounded-full flex items-center gap-1.5"
              style={{ backgroundColor: theme.secondaryFixed || '#ffdfa0' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={theme.onSecondaryFixed || '#261a00'} stroke="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill={theme.secondary || '#795900'}/>
              </svg>
              <span className="text-sm font-bold" style={{ color: theme.onSecondaryFixed || '#261a00' }}>
                {stats.streakDays}天
              </span>
            </div>
          </div>

          {/* Bento Grid: Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Practice Progress Card */}
            <div
              className="col-span-1 p-6 rounded-2xl flex flex-col justify-between h-44 relative overflow-hidden group"
              style={{
                backgroundColor: theme.surfaceContainerLowest || '#ffffff',
                boxShadow: 'none',
              }}
            >
              {/* Decorative background icon */}
              <div
                className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity"
                style={{ transform: 'rotate(12deg)' }}
              >
                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke={theme.primary || '#24389c'} strokeWidth="1" style={{ opacity: 0.15 }}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12h8" />
                  <path d="M12 8v8" />
                </svg>
              </div>
              <div className="flex justify-between items-start relative z-10">
                <div
                  className="p-2 rounded-xl"
                  style={{ backgroundColor: theme.primaryFixed || '#dee0ff' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.primary || '#24389c'} strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 12h8" />
                    <path d="M12 8v8" />
                  </svg>
                </div>
                <span className="text-xs font-bold" style={{ color: theme.primary || '#24389c' }}>{todayProgress}%</span>
              </div>
              <div className="relative z-10">
                <div
                  className="text-2xl font-black"
                  style={{ color: theme.onSurface || '#191c1d', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  {todayQuestions}/{todayGoal}
                </div>
                <div
                  className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: theme.onSurfaceVariant || '#454652' }}
                >
                  今日练习进度
                </div>
              </div>
            </div>

            {/* Cards Reviewed */}
            <div
              className="col-span-1 p-6 rounded-2xl flex flex-col justify-between h-44"
              style={{
                backgroundColor: theme.surfaceContainerLowest || '#ffffff',
                boxShadow: 'none',
              }}
            >
              <div className="flex justify-between items-start">
                <div
                  className="p-2 rounded-xl"
                  style={{ backgroundColor: theme.tertiaryFixed || '#fdd6ff' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.tertiary || '#73008e'} strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18" />
                    <path d="M9 21V9" />
                  </svg>
                </div>
              </div>
              <div>
                <div
                  className="text-2xl font-black"
                  style={{ color: theme.onSurface || '#191c1d', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  {stats.masteredCount + stats.normalCount}
                </div>
                <div
                  className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: theme.onSurfaceVariant || '#454652' }}
                >
                  已掌握卡片
                </div>
              </div>
            </div>

            {/* AI Tutor Banner - Wider */}
            <div
              className="col-span-2 relative overflow-hidden rounded-2xl p-6"
              style={{
                background: `linear-gradient(135deg, ${theme.primary}, ${theme.tertiary || '#73008e'})`,
              }}
            >
              {/* Decorative blur circle - top right */}
              <div
                className="absolute top-0 right-0 w-32 h-32 opacity-20 rounded-full blur-3xl"
                style={{
                  backgroundColor: theme.secondaryContainer || '#ffbf00',
                  transform: 'translate(30%, -30%)',
                }}
              />
              {/* Second decorative blur circle - bottom left */}
              <div
                className="absolute bottom-0 left-0 w-24 h-24 opacity-10 rounded-full blur-2xl"
                style={{
                  backgroundColor: theme.secondaryFixed || '#ffdfa0',
                  transform: 'translate(-30%, 30%)',
                }}
              />
              <div className="relative z-10 flex items-center justify-between">
                <div className="max-w-[55%]">
                  <h3
                    className="text-white font-bold text-lg leading-tight"
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    准备好进行 AI 辅导了吗？
                  </h3>
                  <p className="text-sm mt-1 opacity-90" style={{ color: theme.primaryFixed || '#dee0ff' }}>
                    {reviewPending > 0
                      ? `你还有 ${reviewPending} 个待复习知识点，适合先完成一轮巩固。`
                      : newGoalCompleted
                      ? '今日核心计划已经完成，可以直接进入 AI 问答延展学习。'
                      : `距离今日新学目标还差 ${Math.max(dailyNewGoal - completedNew, 0)} 项。`}
                  </p>
                  <button
                    onClick={() => navigate('ai-chat')}
                    className="mt-4 px-6 py-2 rounded-full text-sm font-bold active:scale-95 transition-transform"
                    style={{ backgroundColor: '#ffffff', color: theme.primary }}
                  >
                    立即开始
                  </button>
                </div>
                <div
                  className="p-4 rounded-2xl"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(10px)' }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Tasks Section - Matches Template */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: theme.onSurface }}>
                今日任务
              </h3>
              <span className="text-sm font-bold" style={{ color: theme.primary }}>查看全部</span>
            </div>
            <div className="space-y-3">
              <div
                onClick={() => reviewTotal > 0 && navigate('review-session', { type: 'review' })}
                className="p-5 rounded-lg flex items-center gap-4 transition-all active:scale-[0.98]"
                style={{ backgroundColor: theme.surfaceContainerLowest || '#ffffff' }}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center"
                  style={{
                    backgroundColor: reviewCompleted ? theme.primary : 'transparent',
                    color: '#ffffff',
                    border: reviewCompleted ? 'none' : `2px solid ${theme.outlineVariant || '#c5c5d4'}`,
                  }}
                >
                  {reviewCompleted && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold" style={{ color: theme.onSurface }}>今日复习</span>
                    <span className="text-xs font-bold" style={{ color: theme.onSurfaceVariant }}>{Math.max(reviewTotal - reviewPending, 0)}/{reviewTotal || reviewPending}</span>
                  </div>
                  <div
                    className="h-2 w-full rounded-full overflow-hidden"
                    style={{ backgroundColor: theme.surfaceContainerHigh || '#e7e8e9' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: theme.primary,
                        width: `${reviewTotal > 0 ? (Math.max(reviewTotal - reviewPending, 0) / reviewTotal) * 100 : reviewCompleted ? 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div
                onClick={() => navigate('knowledge')}
                className="p-5 rounded-lg flex items-center gap-4 transition-all active:scale-[0.98]"
                style={{ backgroundColor: theme.surfaceContainerLowest || '#ffffff' }}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center border-2"
                  style={{ borderColor: theme.outlineVariant || '#c5c5d4' }}
                />
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold" style={{ color: theme.onSurface }}>今日新学</span>
                    <span className="text-xs font-bold" style={{ color: theme.onSurfaceVariant }}>{completedNew}/{dailyNewGoal}</span>
                  </div>
                  <div
                    className="h-2 w-full rounded-full overflow-hidden"
                    style={{ backgroundColor: theme.surfaceContainerHigh || '#e7e8e9' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ backgroundColor: theme.primary, width: `${Math.min(100, (completedNew / Math.max(dailyNewGoal, 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div
                onClick={() => navigate('wrong-book')}
                className="p-5 rounded-lg flex items-center gap-4 transition-all active:scale-[0.98]"
                style={{ backgroundColor: theme.surfaceContainerLowest || '#ffffff' }}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center border-2"
                  style={{ borderColor: theme.outlineVariant || '#c5c5d4' }}
                />
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold" style={{ color: theme.onSurface }}>错题整理</span>
                    <span className="text-xs font-bold" style={{ color: theme.onSurfaceVariant }}>{learningState.wrongRecords.length} 道</span>
                  </div>
                  <div
                    className="h-2 w-full rounded-full overflow-hidden"
                    style={{ backgroundColor: theme.surfaceContainerHigh || '#e7e8e9' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ backgroundColor: theme.primary, width: `${learningState.wrongRecords.length > 0 ? 100 : 0}%`, opacity: learningState.wrongRecords.length > 0 ? 0.7 : 0.18 }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Rewards Progress Indicator - Matches Template */}
          <div
            className="p-6 rounded-lg"
            style={{ backgroundColor: theme.surfaceContainerLow || '#f3f4f5' }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: theme.secondaryFixed || '#ffdfa0' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.onSecondaryFixed || '#261a00'} strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-bold" style={{ color: theme.onSurface }}>升级进度 (Lv. 14)</span>
                  <span className="text-xs font-bold" style={{ color: theme.secondary || '#795900' }}>850 / 1000 XP</span>
                </div>
                <div
                  className="h-1.5 w-full rounded-full overflow-hidden"
                  style={{ backgroundColor: '#ffffff' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ backgroundColor: theme.secondaryFixed || '#ffdfa0', width: '85%' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Learning Overview */}
          <div
            className="rounded-2xl p-6"
            style={{
              backgroundColor: theme.surfaceContainerLowest || '#ffffff',
              boxShadow: 'none',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.primary} strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                学习总览
              </h3>
              <button onClick={() => navigate('profile')} className="text-xs flex items-center gap-0.5" style={{ color: theme.primary }}>
                详情 <ChevronRight size={12} />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs mb-2">
              <span style={{ color: theme.textSecondary }}>掌握度分布</span>
              <span style={{ color: theme.textSecondary }}>共 {stats.totalKnowledgePoints} 个知识点</span>
            </div>

            <ProgressBar value={stats.masteredCount + stats.normalCount} max={stats.totalKnowledgePoints} color="bg-emerald-500" />
            <div className="grid grid-cols-4 gap-2 mt-4">
              {profData.map(d => (
                <div key={d.level} className="text-center">
                  <div className="text-lg font-bold" style={{ color: PROFICIENCY_MAP[d.level].color }}>
                    {d.count}
                  </div>
                  <div className="text-[10px]" style={{ color: theme.textSecondary }}>{PROFICIENCY_MAP[d.level].label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="font-semibold text-sm mb-4">快速开始</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => navigate('quiz')}
                className="text-left transition-transform active:scale-[0.97] p-4 rounded-2xl"
                style={{
                  backgroundColor: theme.surfaceContainerLow || '#f3f4f5',
                  boxShadow: 'none',
                  border: 'none',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-xl"
                    style={{ backgroundColor: theme.primaryFixed || '#dee0ff' }}
                  >
                    <FileQuestion size={20} style={{ color: theme.primary }} />
                  </div>
                  <div>
                    <div className="font-medium text-sm" style={{ color: theme.onSurface }}>开始刷题</div>
                    <div className="text-xs" style={{ color: theme.onSurfaceVariant }}>选择题测试</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate('knowledge')}
                className="text-left transition-transform active:scale-[0.97] p-4 rounded-2xl"
                style={{
                  backgroundColor: theme.surfaceContainerLow || '#f3f4f5',
                  boxShadow: 'none',
                  border: 'none',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-xl"
                    style={{ backgroundColor: theme.primaryFixed || '#dee0ff' }}
                  >
                    <BookOpen size={20} style={{ color: theme.primary }} />
                  </div>
                  <div>
                    <div className="font-medium text-sm" style={{ color: theme.onSurface }}>知识库</div>
                    <div className="text-xs" style={{ color: theme.onSurfaceVariant }}>管理知识点</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate('knowledge-map')}
                className="text-left transition-transform active:scale-[0.97] p-4 rounded-2xl"
                style={{
                  backgroundColor: theme.surfaceContainerLow || '#f3f4f5',
                  boxShadow: 'none',
                  border: 'none',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-xl"
                    style={{ backgroundColor: theme.primaryFixed || '#dee0ff' }}
                  >
                    <Map size={20} style={{ color: theme.primary }} />
                  </div>
                  <div>
                    <div className="font-medium text-sm" style={{ color: theme.onSurface }}>知识图谱</div>
                    <div className="text-xs" style={{ color: theme.onSurfaceVariant }}>可视化进度</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate('quiz', { tab: 'wrong' })}
                className="text-left transition-transform active:scale-[0.97] p-4 rounded-2xl"
                style={{
                  backgroundColor: theme.surfaceContainerLow || '#f3f4f5',
                  boxShadow: 'none',
                  border: 'none',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-xl"
                    style={{ backgroundColor: theme.surfaceContainerHighest || '#e1e3e4' }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.error || '#ba1a1a'} strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-sm" style={{ color: theme.onSurface }}>错题本</div>
                    <div className="text-xs" style={{ color: theme.onSurfaceVariant }}>{learningState.wrongRecords.length} 道错题</div>
                  </div>
                </div>
              </button>

              {/* AI 问答 - Full Width */}
              <button
                onClick={() => navigate('ai-chat')}
                className="col-span-2 text-left transition-transform active:scale-[0.97] p-4 rounded-2xl"
                style={{
                  background: `linear-gradient(135deg, ${theme.primary}15, ${theme.tertiary || '#73008e'}10)`,
                  border: 'none',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="p-2 rounded-xl"
                      style={{ backgroundColor: theme.tertiaryFixed || '#fdd6ff' }}
                    >
                      <Zap size={20} style={{ color: theme.tertiary || '#73008e' }} />
                    </div>
                    <div>
                      <div className="font-medium text-sm" style={{ color: theme.onSurface }}>AI 问答</div>
                      <div className="text-xs" style={{ color: theme.onSurfaceVariant }}>智能学习助手</div>
                    </div>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.primary} strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>
            </div>
          </div>

          {/* Incentive Shortcuts */}
          <div>
            <h3 className="font-semibold text-sm mb-4">每日福利</h3>
            <div className="grid grid-cols-4 gap-3">
              <button
                onClick={() => navigate('checkin')}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-transform active:scale-[0.97]"
                style={{
                  backgroundColor: theme.surfaceContainerLow || '#f3f4f5',
                  boxShadow: 'none',
                  border: 'none',
                }}
              >
                <div
                  className="p-2 rounded-xl"
                  style={{ backgroundColor: theme.secondaryFixed || '#ffdfa0' }}
                >
                  <CalendarCheck size={20} style={{ color: theme.secondary || '#795900' }} />
                </div>
                <span className="text-[11px] font-medium" style={{ color: theme.onSurface }}>签到</span>
              </button>

              <button
                onClick={() => navigate('achievements')}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-transform active:scale-[0.97]"
                style={{
                  backgroundColor: theme.surfaceContainerLow || '#f3f4f5',
                  boxShadow: 'none',
                  border: 'none',
                }}
              >
                <div
                  className="p-2 rounded-xl"
                  style={{ backgroundColor: theme.secondaryFixed || '#ffdfa0' }}
                >
                  <Trophy size={20} style={{ color: theme.secondary || '#795900' }} />
                </div>
                <span className="text-[11px] font-medium" style={{ color: theme.onSurface }}>成就</span>
              </button>

              <button
                onClick={() => navigate('shop')}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-transform active:scale-[0.97]"
                style={{
                  backgroundColor: theme.surfaceContainerLow || '#f3f4f5',
                  boxShadow: 'none',
                  border: 'none',
                }}
              >
                <div
                  className="p-2 rounded-xl"
                  style={{ backgroundColor: theme.tertiaryFixed || '#fdd6ff' }}
                >
                  <ShoppingBag size={20} style={{ color: theme.tertiary || '#73008e' }} />
                </div>
                <span className="text-[11px] font-medium" style={{ color: theme.onSurface }}>商城</span>
              </button>

              <button
                onClick={() => navigate('ranking')}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-transform active:scale-[0.97]"
                style={{
                  backgroundColor: theme.surfaceContainerLow || '#f3f4f5',
                  boxShadow: 'none',
                  border: 'none',
                }}
              >
                <div
                  className="p-2 rounded-xl"
                  style={{ backgroundColor: theme.primaryFixed || '#dee0ff' }}
                >
                  <Medal size={20} style={{ color: theme.primary }} />
                </div>
                <span className="text-[11px] font-medium" style={{ color: theme.onSurface }}>排行</span>
              </button>
            </div>
          </div>

          {/* Weak Subjects */}
          {stats.weakSubjects.length > 0 && (
            <div
              className="rounded-2xl p-4"
              style={{
                backgroundColor: `${theme.error || '#ba1a1a'}10`,
              }}
            >
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2" style={{ color: theme.error || '#ba1a1a' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                薄弱学科提醒
              </h4>
              <div className="flex flex-wrap gap-2">
                {stats.weakSubjects.map(s => (
                  <span
                    key={s}
                    className="text-xs px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: `${theme.error || '#ba1a1a'}20`,
                      color: theme.error || '#ba1a1a',
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Floating AI Button */}
        <FloatingAIPanel />
      </div>
    );
  }

  // ===== Playful 风格渲染（保持原有样式）=====
  return (
    <div className="page-scroll pb-4" style={{ backgroundColor: theme.bg, minHeight: '100vh' }}>
      {/* Gradient Header */}
      <div
        className="text-white px-6 pt-16 pb-10 rounded-b-3xl overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">{getGreeting()}</h2>
            <p className="text-sm mt-0.5" style={{ color: '#ffffff' }}>{appState.user?.nickname ?? '同学'}</p>
          </div>
          <div className="bg-white/20 rounded-full px-3 py-1">
            <span className="text-sm">🔥 {stats.streakDays}天</span>
          </div>
        </div>

        {/* AI encouragement */}
        <button
          onClick={() => navigate('ai-chat')}
          className="w-full bg-white/10 rounded-xl p-3 flex items-start gap-2 active:bg-white/20 transition-colors text-left"
        >
          <Sparkles size={16} className="text-secondary-light mt-0.5 shrink-0" />
          <p className="text-sm flex-1" style={{ color: '#ffffff' }}>{encouragementText}</p>
          <ChevronRight size={14} className="text-white/50 mt-0.5 shrink-0" />
        </button>
      </div>

      {/* Today's Tasks */}
      <div className={`mt-4 ${getAnimationClass(1)}`} style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)' }}>
        <div
          style={{
            backgroundColor: theme.bgCard,
            borderRadius: 'var(--card-radius)',
            padding: 'var(--card-padding)',
            boxShadow: theme.cardShadow !== 'none' ? '0 4px 12px -2px rgba(0, 0, 0, 0.1)' : 'none',
            border: `1px solid ${theme.border}`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-1.5">
              <Target size={16} style={{ color: theme.primary }} />
              今日学习任务
            </h3>
            <span className="text-xs" style={{ color: theme.textMuted }}>
              {reviewPending > 0 ? '复习中' : freeLearningMode ? '目标完成 🎉' : '新学中'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => reviewPending > 0 && navigate('review-session', { type: 'review' })}
              className="text-left transition-transform active:scale-[0.97]"
              style={{
                background: reviewPending > 0
                  ? `linear-gradient(135deg, ${theme.secondaryLight}20, ${theme.secondary}20)`
                  : theme.bgCard,
                borderRadius: 'var(--card-radius)',
                padding: 'var(--card-padding)',
                border: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Brain size={14} style={{ color: reviewPending > 0 ? theme.secondary : theme.textMuted }} />
                <span className="text-xs font-medium" style={{ color: reviewPending > 0 ? theme.secondary : theme.textMuted }}>待复习</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: reviewPending > 0 ? theme.secondary : theme.textMuted }}>{reviewPending}</div>
              <div className="text-[10px] mt-0.5" style={{ color: reviewPending > 0 ? theme.secondaryLight : theme.textMuted }}>个知识点</div>
            </button>

            <button
              onClick={() => {
                if (reviewPending > 0) {
                  navigate('review-session', { type: 'review' });
                } else {
                  navigate('review-session', { type: 'new' });
                }
              }}
              className="text-left transition-transform active:scale-[0.97]"
              style={{
                background: freeLearningMode
                  ? `linear-gradient(135deg, ${theme.success}20, ${theme.accent}20)`
                  : reviewPending > 0 || completedNew < dailyNewGoal
                    ? `linear-gradient(135deg, ${theme.primary}20, ${theme.primaryLight}20)`
                    : `linear-gradient(135deg, ${theme.success}20, ${theme.accent}20)`,
                borderRadius: 'var(--card-radius)',
                padding: 'var(--card-padding)',
                border: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {freeLearningMode ? (
                  <CheckCircle size={14} style={{ color: theme.success }} />
                ) : (
                  <Play size={14} style={{ color: theme.primary }} />
                )}
                <span className="text-xs font-medium" style={{ color: freeLearningMode ? theme.success : theme.primary }}>
                  {freeLearningMode ? '自由学习' : '开始学习'}
                </span>
              </div>
              <div className="text-2xl font-bold" style={{ color: freeLearningMode ? theme.success : theme.primary }}>
                {freeLearningMode ? '🎉' : reviewPending > 0 ? `${reviewPending}` : `${completedNew}/${dailyNewGoal}`}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: freeLearningMode ? theme.accent : theme.primaryLight }}>
                {freeLearningMode
                  ? '目标已完成，自由学习'
                  : reviewPending > 0
                    ? `待复习 + ${dailyNewGoal} 新学目标`
                    : `新学 ${completedNew}/${dailyNewGoal}`}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Learning Overview */}
      <div className={`mt-4 ${getAnimationClass(2)}`} style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            <TrendingUp size={16} style={{ color: theme.primary }} />
            学习总览
          </h3>
          <button onClick={() => navigate('profile')} className="text-xs flex items-center gap-0.5" style={{ color: theme.primary }}>
            详情 <ChevronRight size={12} />
          </button>
        </div>

        <div
          style={{
            backgroundColor: theme.bgCard,
            borderRadius: 'var(--card-radius)',
            padding: 'var(--card-padding)',
            boxShadow: theme.cardShadow !== 'none' ? '0 4px 12px -2px rgba(0, 0, 0, 0.1)' : 'none',
            border: 'none',
          }}
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <span style={{ color: theme.textSecondary }}>掌握度分布</span>
            <span style={{ color: theme.textSecondary }}>共 {stats.totalKnowledgePoints} 个知识点</span>
          </div>

          <ProgressBar value={stats.masteredCount + stats.normalCount} max={stats.totalKnowledgePoints} color="bg-accent" />
          <div className="grid grid-cols-4 gap-2 mt-3">
            {profData.map(d => (
              <div key={d.level} className="text-center">
                <div className="text-lg font-bold" style={{ color: PROFICIENCY_MAP[d.level].color }}>
                  {d.count}
                </div>
                <div className="text-[10px]" style={{ color: theme.textSecondary }}>{PROFICIENCY_MAP[d.level].label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Incentive Shortcuts */}
      <div className={`mt-4 ${getAnimationClass(3)}`} style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">每日福利</h3>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <button
            onClick={() => navigate('checkin')}
            className="flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: theme.bgCard,
              borderRadius: 'var(--card-radius)',
              padding: 'var(--card-padding)',
              boxShadow: theme.cardShadow !== 'none' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
              border: 'none',
            }}
          >
            <CalendarCheck size={20} style={{ color: theme.iconColors.checkin }} />
            <span className="text-[11px] font-medium" style={{ color: theme.textPrimary }}>签到</span>
          </button>

          <button
            onClick={() => navigate('achievements')}
            className="flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: theme.bgCard,
              borderRadius: 'var(--card-radius)',
              padding: 'var(--card-padding)',
              boxShadow: theme.cardShadow !== 'none' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
              border: 'none',
            }}
          >
            <Trophy size={20} style={{ color: theme.iconColors.achievement }} />
            <span className="text-[11px] font-medium" style={{ color: theme.textPrimary }}>成就</span>
          </button>

          <button
            onClick={() => navigate('shop')}
            className="flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: theme.bgCard,
              borderRadius: 'var(--card-radius)',
              padding: 'var(--card-padding)',
              boxShadow: theme.cardShadow !== 'none' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
              border: 'none',
            }}
          >
            <ShoppingBag size={20} style={{ color: theme.iconColors.shop }} />
            <span className="text-[11px] font-medium" style={{ color: theme.textPrimary }}>商城</span>
          </button>

          <button
            onClick={() => navigate('ranking')}
            className="flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: theme.bgCard,
              borderRadius: 'var(--card-radius)',
              padding: 'var(--card-padding)',
              boxShadow: theme.cardShadow !== 'none' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
              border: 'none',
            }}
          >
            <Medal size={20} style={{ color: theme.iconColors.ranking }} />
            <span className="text-[11px] font-medium" style={{ color: theme.textPrimary }}>排行</span>
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={`mt-4 ${getAnimationClass(4)}`} style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)' }}>
        <h3 className="font-semibold text-sm mb-3">快速开始</h3>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('quiz')}
            className="text-left active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: theme.bgCard,
              borderRadius: 'var(--card-radius)',
              padding: 'var(--card-padding)',
              boxShadow: theme.cardShadow !== 'none' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
              border: 'none',
            }}
          >
            <div className="text-2xl mb-2">📝</div>
            <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>开始刷题</div>
            <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>选择题测试</div>
          </button>

          <button
            onClick={() => navigate('knowledge')}
            className="text-left active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: theme.bgCard,
              borderRadius: 'var(--card-radius)',
              padding: 'var(--card-padding)',
              boxShadow: theme.cardShadow !== 'none' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
              border: 'none',
            }}
          >
            <div className="text-2xl mb-2">📚</div>
            <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>知识库</div>
            <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>管理知识点</div>
          </button>

          <button
            onClick={() => navigate('knowledge-map')}
            className="text-left active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: theme.bgCard,
              borderRadius: 'var(--card-radius)',
              padding: 'var(--card-padding)',
              boxShadow: theme.cardShadow !== 'none' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
              border: 'none',
            }}
          >
            <div className="text-2xl mb-2">🗺️</div>
            <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>知识图谱</div>
            <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>可视化学习进度</div>
          </button>

          <button
            onClick={() => navigate('quiz', { tab: 'wrong' })}
            className="text-left active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: theme.bgCard,
              borderRadius: 'var(--card-radius)',
              padding: 'var(--card-padding)',
              boxShadow: theme.cardShadow !== 'none' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
              border: 'none',
            }}
          >
            <div className="text-2xl mb-2">❌</div>
            <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>错题本</div>
            <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>{learningState.wrongRecords.length} 道错题</div>
          </button>

          <button
            onClick={() => navigate('ai-chat')}
            className="text-left active:scale-[0.97] transition-transform"
            style={{
              background: `linear-gradient(135deg, ${theme.primary}20, ${theme.primaryLight}10)`,
              borderRadius: 'var(--card-radius)',
              padding: 'var(--card-padding)',
              border: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            <Bot size={24} style={{ color: theme.primary }} className="mb-2" />
            <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>AI 问答</div>
            <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>智能学习助手</div>
          </button>

          <button
            onClick={() => navigate('flashcard-learning')}
            className="text-left active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: theme.bgCard,
              borderRadius: 'var(--card-radius)',
              padding: 'var(--card-padding)',
              boxShadow: theme.cardShadow !== 'none' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
              border: 'none',
            }}
          >
            <div className="text-2xl mb-2">🧠</div>
            <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>闪记学习</div>
            <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>记忆卡片式学习</div>
          </button>
        </div>
      </div>

      {/* Weak Subjects */}
      {stats.weakSubjects.length > 0 && (
        <div className={`mt-4 ${getAnimationClass(5)}`} style={{ paddingLeft: 'var(--page-padding)', paddingRight: 'var(--page-padding)', paddingBottom: '24px' }}>
          <div
            style={{
              backgroundColor: `${theme.danger}15`,
              borderRadius: 'var(--card-radius)',
              padding: 'var(--card-padding)',
              border: `1px solid ${theme.danger}30`,
            }}
          >
            <h4 className="text-sm font-medium mb-2" style={{ color: theme.danger }}>⚠️ 薄弱学科提醒</h4>
            <div className="flex flex-wrap gap-2">
              {stats.weakSubjects.map(s => (
                <span
                  key={s}
                  className="text-xs px-2 py-1 rounded-full"
                  style={{
                    backgroundColor: `${theme.danger}20`,
                    color: theme.danger
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
