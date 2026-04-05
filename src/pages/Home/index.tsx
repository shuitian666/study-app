/**
 * ============================================================================
 * 首页 (Home Page)
 * ============================================================================
 *
 * 【页面布局】从上到下：
 * 1. 渐变头部：问候语 + 用户昵称 + 连续学习天数 + AI 鼓励语（可点击跳转 ai-chat）
 * 2. 今日学习任务卡片：待复习 / 开始学习（点击进入 review-session）
 * 3. 学习总览：掌握度分布条 + 四级统计
 * 4. 每日福利：签到 / 成就 / 商城 / 排行（4 宫格快捷入口）
 * 5. 快速开始：刷题 / 知识库 / 知识图谱 / 错题本 / AI问答（5 格）
 * 6. 薄弱学科提醒（条件渲染）
 *
 * 【AI 集成点 (Phase 3)】
 * - 鼓励语：每日首次加载时调 aiService.getSmartEncouragement()，结果缓存到 state
 * - AI 入口：鼓励语区域可点击 + 快速开始中的"AI 问答"按钮，均跳转 ai-chat
 * ============================================================================
 */

import { useEffect, useState } from 'react';
import { useApp } from '@/store/AppContext';
import { useUser } from '@/store/UserContext';
import { useTheme } from '@/store/ThemeContext';
import { generateTodayReviewPlan, getGreeting, getEncouragement } from '@/utils/review';
import { getSmartEncouragement } from '@/services/aiService';
import { PROFICIENCY_MAP } from '@/types';
import type { ProficiencyLevel } from '@/types';
import { Brain, Target, TrendingUp, ChevronRight, Sparkles, CalendarCheck, Trophy, ShoppingBag, Medal, Bot, Play, CheckCircle } from 'lucide-react';
import { ProgressBar } from '@/components/ui/Common';

export default function HomePage() {

  const { state, dispatch, getLearningStats } = useApp();
  const { navigate } = useUser();
  const { theme } = useTheme();
  const stats = getLearningStats();

  // 本地缓存鼓励语，避免每次渲染随机变化
  const [fallbackEncouragement] = useState(() => getEncouragement());

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

  useEffect(() => {
    // Pass existingNewItems to preserve completed state when regenerating
    const { review, newItems } = generateTodayReviewPlan(state.knowledgePoints, state.todayNewItems);
    dispatch({ type: 'SET_REVIEW_ITEMS', payload: { review, newItems } });
  }, [state.knowledgePoints, state.todayNewItems, dispatch]);

  // Daily smart encouragement - only run when date or key values change
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (state.dailyEncouragementDate !== today) {
      getSmartEncouragement(stats, state.wrongRecords.length, state.checkin.streak).then(text => {
        dispatch({ type: 'SET_DAILY_ENCOURAGEMENT', payload: { text, date: today } });
      });
    }
  }, [state.dailyEncouragementDate, state.wrongRecords.length, state.checkin.streak, dispatch]);

  const encouragementText = state.dailyEncouragement ?? fallbackEncouragement;

  const reviewPending = state.todayReviewItems.filter(r => !r.completed).length;
  const completedNew = state.todayNewItems.filter(r => r.completed).length;
  const dailyNewGoal = state.user?.dailyNewGoal ?? 10;
  
  // 复习是否完成
  const reviewCompleted = reviewPending === 0;
  // 新学目标是否完成
  const newGoalCompleted = completedNew >= dailyNewGoal;
  // 是否有待学习的内容
  const hasPendingNew = state.todayNewItems.filter(r => !r.completed).length > 0;
  // 是否进入自由学习模式
  const freeLearningMode = reviewCompleted && newGoalCompleted && hasPendingNew;

  const profData: { level: ProficiencyLevel; count: number }[] = [
    { level: 'master', count: stats.masteredCount },
    { level: 'normal', count: stats.normalCount },
    { level: 'rusty', count: stats.rustyCount },
    { level: 'none', count: stats.noneCount },
  ];

  return (
    <div className="page-scroll pb-4">
      {/* Header Greeting */}
      <div
        className="text-white px-6 pt-16 pb-10 rounded-b-3xl overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">{getGreeting()}</h2>
            <p className="text-sm mt-0.5" style={{ color: '#ffffff' }}>{state.user?.nickname ?? '同学'}</p>
          </div>

          <div className="bg-white/20 rounded-full px-3 py-1">
            <span className="text-sm">🔥 {stats.streakDays}天</span>
          </div>
        </div>


        {/* AI encouragement - clickable to open AI chat */}
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
      <div className={`px-4 mt-4 ${getAnimationClass(1)}`}>
        <div 
          className="rounded-2xl shadow-md p-4 border"
          style={{
            backgroundColor: theme.bgCard,
            borderColor: theme.border
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-1.5">
              <Target size={16} className="text-primary" />
              今日学习任务
            </h3>

            <span className="text-xs text-text-muted">
              {reviewPending > 0 
                ? `复习中` 
                : freeLearningMode 
                  ? '自由学习中' 
                  : newGoalCompleted ? '目标完成 🎉' : '新学中'}
            </span>

          </div>


          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                if (reviewPending > 0) navigate('review-session', { type: 'review' });
              }}
              className={`rounded-xl p-3 text-left border transition-transform active:scale-[0.97] ${
                reviewPending > 0 
                  ? 'bg-gradient-to-br' 
                  : 'bg-opacity-50'
              }`}
              style={{
                background: reviewPending > 0 
                  ? `linear-gradient(135deg, ${theme.secondaryLight}20, ${theme.secondary}20)` 
                  : theme.bgCard,
                borderColor: reviewPending > 0 
                  ? `${theme.secondary}40` 
                  : theme.border
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
                // 智能选择学习阶段
                if (reviewPending > 0) {
                  navigate('review-session', { type: 'review' });
                } else {
                  navigate('review-session', { type: 'new' });
                }
              }}
              className={`rounded-xl p-3 text-left border transition-transform active:scale-[0.97] bg-gradient-to-br`}
              style={{
                background: freeLearningMode
                  ? `linear-gradient(135deg, ${theme.success}20, ${theme.accent}20)`
                  : reviewPending > 0 || completedNew < dailyNewGoal
                    ? `linear-gradient(135deg, ${theme.primary}20, ${theme.primaryLight}20)` 
                    : `linear-gradient(135deg, ${theme.success}20, ${theme.accent}20)`,
                borderColor: freeLearningMode
                  ? `${theme.success}40`
                  : reviewPending > 0 || completedNew < dailyNewGoal
                    ? `${theme.primary}40` 
                    : `${theme.success}40`
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
      <div className={`px-4 mt-4 ${getAnimationClass(2)}`}>
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
          className="rounded-2xl p-4 border shadow-sm"
          style={{
            backgroundColor: theme.bgCard,
            borderColor: theme.border
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
      <div className={`px-4 mt-4 ${getAnimationClass(3)}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">每日福利</h3>

        </div>

        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => navigate('checkin')}
            className="rounded-xl p-3 border shadow-sm flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: theme.bgCard,
              borderColor: theme.border
            }}
          >
            <CalendarCheck size={20} style={{ color: theme.iconColors.checkin }} />
            <span className="text-[11px] font-medium" style={{ color: theme.textPrimary }}>签到</span>

          </button>

          <button
            onClick={() => navigate('achievements')}
            className="rounded-xl p-3 border shadow-sm flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: theme.bgCard,
              borderColor: theme.border
            }}
          >
            <Trophy size={20} style={{ color: theme.iconColors.achievement }} />
            <span className="text-[11px] font-medium" style={{ color: theme.textPrimary }}>成就</span>

          </button>

          <button
            onClick={() => navigate('shop')}
            className="rounded-xl p-3 border shadow-sm flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: theme.bgCard,
              borderColor: theme.border
            }}
          >
            <ShoppingBag size={20} style={{ color: theme.iconColors.shop }} />
            <span className="text-[11px] font-medium" style={{ color: theme.textPrimary }}>商城</span>

          </button>

          <button
            onClick={() => navigate('ranking')}
            className="rounded-xl p-3 border shadow-sm flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: theme.bgCard,
              borderColor: theme.border
            }}
          >
            <Medal size={20} style={{ color: theme.iconColors.ranking }} />
            <span className="text-[11px] font-medium" style={{ color: theme.textPrimary }}>排行</span>

          </button>

        </div>

      </div>


      {/* Quick Actions */}
      <div className={`px-4 mt-4 ${getAnimationClass(4)}`}>
        <h3 className="font-semibold text-sm mb-3">快速开始</h3>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('quiz')}
            className="rounded-2xl p-4 border shadow-sm text-left active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: theme.bgCard,
              borderColor: theme.border
            }}
          >
            <div className="text-2xl mb-2">📝</div>
            <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>开始刷题</div>
            <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>选择题测试</div>

          </button>

          <button
            onClick={() => navigate('knowledge')}
            className="rounded-2xl p-4 border shadow-sm text-left active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: theme.bgCard,
              borderColor: theme.border
            }}
          >
            <div className="text-2xl mb-2">📚</div>
            <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>知识库</div>
            <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>管理知识点</div>

          </button>

          <button
            onClick={() => navigate('knowledge-map')}
            className="rounded-2xl p-4 border shadow-sm text-left active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: theme.bgCard,
              borderColor: theme.border
            }}
          >
            <div className="text-2xl mb-2">🗺️</div>
            <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>知识图谱</div>
            <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>可视化学习进度</div>

          </button>

          <button
            onClick={() => navigate('quiz', { tab: 'wrong' })}
            className="rounded-2xl p-4 border shadow-sm text-left active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: theme.bgCard,
              borderColor: theme.border
            }}
          >
            <div className="text-2xl mb-2">❌</div>
            <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>错题本</div>
            <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>{state.wrongRecords.length} 道错题</div>

          </button>

          <button
            onClick={() => navigate('ai-chat')}
            className="rounded-2xl p-4 border shadow-sm text-left active:scale-[0.97] transition-transform"
            style={{
              background: `linear-gradient(135deg, ${theme.primary}20, ${theme.primaryLight}10)`,
              borderColor: `${theme.primary}40`
            }}
          >
            <Bot size={24} style={{ color: theme.primary }} className="mb-2" />
            <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>AI 问答</div>
            <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>智能学习助手</div>

          </button>

          <button
            onClick={() => navigate('flashcard-learning')}
            className="rounded-2xl p-4 border shadow-sm text-left active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: theme.bgCard,
              borderColor: theme.border
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
        <div className={`px-4 mt-4 ${getAnimationClass(5)}`}>
          <div 
            className="rounded-2xl p-4 border"
            style={{
              backgroundColor: `${theme.danger}20`,
              borderColor: `${theme.danger}40`
            }}
          >
            <h4 className="text-sm font-medium mb-2" style={{ color: theme.danger }}>⚠️ 薄弱学科提醒</h4>

            <div className="flex flex-wrap gap-2">
              {stats.weakSubjects.map(s => (
                <span 
                  key={s} 
                  className="text-xs px-2 py-1 rounded-full"
                  style={{
                    backgroundColor: `${theme.danger}30`,
                    color: theme.danger
                  }}
                >{s}</span>
              ))}
            </div>

          </div>

        </div>

      )}

    </div>

  );
}
