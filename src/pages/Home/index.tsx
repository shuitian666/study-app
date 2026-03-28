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

import { useEffect } from 'react';
import { useApp } from '@/store/AppContext';
import { generateTodayReviewPlan, getGreeting, getEncouragement } from '@/utils/review';
import { getSmartEncouragement } from '@/services/aiService';
import { PROFICIENCY_MAP } from '@/types';
import type { ProficiencyLevel } from '@/types';
import { Brain, Target, TrendingUp, ChevronRight, Sparkles, CalendarCheck, Trophy, ShoppingBag, Medal, Bot, Play, CheckCircle } from 'lucide-react';
import { ProgressBar } from '@/components/ui/Common';

export default function HomePage() {

  const { state, dispatch, getLearningStats, navigate } = useApp();
  const stats = getLearningStats();

  useEffect(() => {
    // Pass existingNewItems to preserve completed state when regenerating
    const { review, newItems } = generateTodayReviewPlan(state.knowledgePoints, state.todayNewItems);
    dispatch({ type: 'SET_REVIEW_ITEMS', payload: { review, newItems } });
  }, [state.knowledgePoints, dispatch]);

  // Daily smart encouragement
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (state.dailyEncouragementDate !== today) {
      getSmartEncouragement(stats, state.wrongRecords.length, state.checkin.streak).then(text => {
        dispatch({ type: 'SET_DAILY_ENCOURAGEMENT', payload: { text, date: today } });
      });
    }
  }, [state.dailyEncouragementDate, stats, state.wrongRecords.length, state.checkin.streak, dispatch]);

  const encouragementText = state.dailyEncouragement ?? getEncouragement();

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
      <div className="bg-gradient-to-br from-primary to-primary-dark text-white px-5 pt-10 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">{getGreeting()}</h2>
            <p className="text-white/70 text-sm mt-0.5">{state.user?.nickname ?? '同学'}</p>
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
          <p className="text-sm text-white/90 flex-1">{encouragementText}</p>
          <ChevronRight size={14} className="text-white/50 mt-0.5 shrink-0" />
        </button>

      </div>


      {/* Today's Tasks */}
      <div className="px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-md p-4 border border-border">
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
                  ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100' 
                  : 'bg-gray-50 border-gray-100'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Brain size={14} className={reviewPending > 0 ? 'text-orange-500' : 'text-gray-400'} />
                <span className={`text-xs font-medium ${reviewPending > 0 ? 'text-orange-700' : 'text-gray-400'}`}>待复习</span>
              </div>

              <div className={`text-2xl font-bold ${reviewPending > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{reviewPending}</div>

              <div className={`text-[10px] mt-0.5 ${reviewPending > 0 ? 'text-orange-400' : 'text-gray-400'}`}>个知识点</div>

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
              className={`rounded-xl p-3 text-left border transition-transform active:scale-[0.97] ${
                freeLearningMode
                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100'
                  : reviewPending > 0 || completedNew < dailyNewGoal
                    ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100' 
                    : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {freeLearningMode ? (
                  <CheckCircle size={14} className="text-green-500" />
                ) : (
                  <Play size={14} className="text-blue-500" />
                )}
                <span className={`text-xs font-medium ${freeLearningMode ? 'text-green-700' : 'text-blue-700'}`}>
                  {freeLearningMode ? '自由学习' : '开始学习'}
                </span>
              </div>

              <div className={`text-2xl font-bold ${freeLearningMode ? 'text-green-600' : 'text-blue-600'}`}>
                {freeLearningMode ? '🎉' : reviewPending > 0 ? `${reviewPending}` : `${completedNew}/${dailyNewGoal}`}
              </div>

              <div className={`text-[10px] mt-0.5 ${freeLearningMode ? 'text-green-400' : 'text-blue-400'}`}>
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
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            <TrendingUp size={16} className="text-primary" />
            学习总览
          </h3>

          <button onClick={() => navigate('profile')} className="text-xs text-primary flex items-center gap-0.5">
            详情 <ChevronRight size={12} />
          </button>

        </div>


        <div className="bg-white rounded-2xl p-4 border border-border shadow-sm">
          <div className="flex items-center justify-between text-xs text-text-muted mb-2">
            <span>掌握度分布</span>
            <span>共 {stats.totalKnowledgePoints} 个知识点</span>
          </div>

          <ProgressBar value={stats.masteredCount + stats.normalCount} max={stats.totalKnowledgePoints} color="bg-accent" />
          <div className="grid grid-cols-4 gap-2 mt-3">
            {profData.map(d => (
              <div key={d.level} className="text-center">
                <div className="text-lg font-bold" style={{ color: PROFICIENCY_MAP[d.level].color }}>
                  {d.count}
                </div>

                <div className="text-[10px] text-text-muted">{PROFICIENCY_MAP[d.level].label}</div>

              </div>

            ))}
          </div>

        </div>

      </div>


      {/* Incentive Shortcuts */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">每日福利</h3>

        </div>

        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => navigate('checkin')}
            className="bg-white rounded-xl p-3 border border-border shadow-sm flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
          >
            <CalendarCheck size={20} className="text-orange-500" />
            <span className="text-[11px] font-medium">签到</span>

          </button>

          <button
            onClick={() => navigate('achievements')}
            className="bg-white rounded-xl p-3 border border-border shadow-sm flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
          >
            <Trophy size={20} className="text-yellow-500" />
            <span className="text-[11px] font-medium">成就</span>

          </button>

          <button
            onClick={() => navigate('shop')}
            className="bg-white rounded-xl p-3 border border-border shadow-sm flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
          >
            <ShoppingBag size={20} className="text-purple-500" />
            <span className="text-[11px] font-medium">商城</span>

          </button>

          <button
            onClick={() => navigate('ranking')}
            className="bg-white rounded-xl p-3 border border-border shadow-sm flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
          >
            <Medal size={20} className="text-blue-500" />
            <span className="text-[11px] font-medium">排行</span>

          </button>

        </div>

      </div>


      {/* Quick Actions */}
      <div className="px-4 mt-4">
        <h3 className="font-semibold text-sm mb-3">快速开始</h3>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('quiz')}
            className="bg-white rounded-2xl p-4 border border-border shadow-sm text-left active:scale-[0.97] transition-transform"
          >
            <div className="text-2xl mb-2">📝</div>
            <div className="font-medium text-sm">开始刷题</div>
            <div className="text-xs text-text-muted mt-0.5">选择题测试</div>

          </button>

          <button
            onClick={() => navigate('knowledge')}
            className="bg-white rounded-2xl p-4 border border-border shadow-sm text-left active:scale-[0.97] transition-transform"
          >
            <div className="text-2xl mb-2">📚</div>
            <div className="font-medium text-sm">知识库</div>
            <div className="text-xs text-text-muted mt-0.5">管理知识点</div>

          </button>

          <button
            onClick={() => navigate('knowledge-map')}
            className="bg-white rounded-2xl p-4 border border-border shadow-sm text-left active:scale-[0.97] transition-transform"
          >
            <div className="text-2xl mb-2">🗺️</div>
            <div className="font-medium text-sm">知识图谱</div>
            <div className="text-xs text-text-muted mt-0.5">可视化学习进度</div>

          </button>

          <button
            onClick={() => navigate('quiz', { tab: 'wrong' })}
            className="bg-white rounded-2xl p-4 border border-border shadow-sm text-left active:scale-[0.97] transition-transform"
          >
            <div className="text-2xl mb-2">❌</div>
            <div className="font-medium text-sm">错题本</div>
            <div className="text-xs text-text-muted mt-0.5">{state.wrongRecords.length} 道错题</div>

          </button>

          <button
            onClick={() => navigate('ai-chat')}
            className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-4 border border-violet-100 shadow-sm text-left active:scale-[0.97] transition-transform"
          >
            <Bot size={24} className="text-violet-500 mb-2" />
            <div className="font-medium text-sm">AI 问答</div>
            <div className="text-xs text-text-muted mt-0.5">智能学习助手</div>

          </button>

        </div>

      </div>


      {/* Weak Subjects */}
      {stats.weakSubjects.length > 0 && (
        <div className="px-4 mt-4">
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
            <h4 className="text-sm font-medium text-red-700 mb-2">⚠️ 薄弱学科提醒</h4>

            <div className="flex flex-wrap gap-2">
              {stats.weakSubjects.map(s => (
                <span key={s} className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full">{s}</span>
              ))}
            </div>

          </div>

        </div>

      )}

    </div>

  );
}
