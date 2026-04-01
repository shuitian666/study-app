/**
 * @section QUIZ_RESULT
 * @user:学习目标 @user:继续学习 @user:下一阶段 @user:预生成
 * 
 * 结算页面功能:
 * 1. 显示得分和统计
 * 2. 显示学习目标进度
 * 3. 达成目标后显示签到条件满足提示
 * 4. 预生成下一阶段题目
 * 5. 提供"继续学习"、"查看解析"按钮
 * 
 * @depends src/hooks/usePreGenerate.ts | src/pages/Quiz/QuizSession.tsx | src/store/AppContext.tsx
 */

import { useEffect, useState } from 'react';
import { useApp } from '@/store/AppContext';
import { usePreGenerate } from '@/hooks/usePreGenerate';
import { getKnowledgeExplain } from '@/services/aiService';
import { Trophy, RotateCcw, Home, BookOpen, ArrowRight, Sparkles, Target, CheckCircle2, FileText, Loader2, MessageSquare } from 'lucide-react';

export default function QuizResultPage() {
  const { state, navigate } = useApp();
  const { generateNextStageQuestions, getSavedExplanation } = usePreGenerate();
  
  const score = Number(state.pageParams.score ?? 0);
  const correct = Number(state.pageParams.correct ?? 0);
  const total = Number(state.pageParams.total ?? 0);
  const subjectId = state.pageParams.subjectId;
  const currentStage = Number(state.pageParams.stage ?? 0);
  const nextStage = currentStage + 1;
  
  // 学习目标进度
  const dailyGoal = state.user?.dailyGoal ?? 10;
  const [todayQuestions, setTodayQuestions] = useState(0);
  
  // 预生成状态
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState({ current: 0, total: 0 });
  const [generatingOne, setGeneratingOne] = useState<string | null>(null);
  
  // 获取当前阶段的题目解析
  const [showExplanations, setShowExplanations] = useState(false);
  const stageQuestions = state.quizResults.length > 0 
    ? state.questions.filter(q => q.subjectId === subjectId).slice(-total)
    : [];

  useEffect(() => {
    const today = new Date().toDateString();
    const todayResults = state.quizResults.filter(r => 
      new Date(r.completedAt).toDateString() === today
    );
    const totalToday = todayResults.reduce((sum, r) => sum + r.totalQuestions, 0);
    setTodayQuestions(totalToday);
  }, [state.quizResults]);

  // 预生成下一阶段题目
  const handlePreGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    
    const kpIds = state.knowledgePoints
      .filter(kp => kp.subjectId === subjectId)
      .map(kp => kp.id);
    
    await generateNextStageQuestions(subjectId ?? '', kpIds, 5, (current, t) => {
      setGenProgress({ current, total: t });
    });
    
    setGenerating(false);
    setGenProgress({ current: 0, total: 0 });
  };

  const goalProgress = Math.min((todayQuestions / dailyGoal) * 100, 100);
  const goalAchieved = todayQuestions >= dailyGoal;

  const getScoreColor = () => {
    if (score >= 80) return 'text-accent';
    if (score >= 60) return 'text-warning';
    return 'text-danger';
  };

  const getScoreEmoji = () => {
    if (score === 100) return '🎉';
    if (score >= 80) return '👏';
    if (score >= 60) return '💪';
    return '📚';
  };

  const getMessage = () => {
    if (score === 100) return '满分！太棒了！';
    if (score >= 80) return '表现优秀，继续保持！';
    if (score >= 60) return '还不错，继续努力！';
    return '需要加油了，多复习薄弱知识点！';
  };

  const handleContinueLearning = () => {
    if (subjectId) {
      navigate('quiz-session', { subjectId, stage: String(nextStage) });
    } else {
      navigate('quiz');
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 bg-bg overflow-y-auto pb-8">
      {/* Score circle */}
      <div className="relative mb-6">
        <div className="w-36 h-36 rounded-full bg-white shadow-lg flex items-center justify-center border-4 border-border">
          <div className="text-center">
            <div className="text-4xl mb-1">{getScoreEmoji()}</div>
            <div className={`text-3xl font-bold ${getScoreColor()}`}>{score}</div>
            <div className="text-xs text-text-muted">分</div>
          </div>
        </div>

        <div className="absolute -top-2 -right-2 bg-secondary text-white p-1.5 rounded-full">
          <Trophy size={16} />
        </div>
      </div>

      <h2 className="text-lg font-bold mb-1">{getMessage()}</h2>
      <p className="text-sm text-text-muted mb-6">
        共 {total} 题，答对 {correct} 题
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs mb-6">
        <div className="bg-white rounded-xl p-3 text-center border border-border">
          <div className="text-lg font-bold text-accent">{correct}</div>
          <div className="text-[10px] text-text-muted">正确</div>
        </div>
        <div className="bg-white rounded-xl p-3 text-center border border-border">
          <div className="text-lg font-bold text-danger">{total - correct}</div>
          <div className="text-[10px] text-text-muted">错误</div>
        </div>
        <div className="bg-white rounded-xl p-3 text-center border border-border">
          <div className="text-lg font-bold text-primary">{score}%</div>
          <div className="text-[10px] text-text-muted">正确率</div>
        </div>
      </div>

      {/* 学习目标进度 */}
      <div className="w-full max-w-xs mb-4">
        <div className={`rounded-2xl p-4 border ${goalAchieved ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Target size={16} className={goalAchieved ? 'text-green-600' : 'text-blue-600'} />
            <span className={`text-sm font-medium ${goalAchieved ? 'text-green-700' : 'text-blue-700'}`}>今日学习目标</span>
            {goalAchieved && (
              <div className="ml-auto flex items-center gap-1 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                <CheckCircle2 size={12} />
已达成
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between text-xs text-text-secondary mb-2">
            <span>已完成 {todayQuestions} 题</span>
            <span>目标 {dailyGoal} 题</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${goalAchieved ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${goalProgress}%` }}
            />
          </div>
          
          {goalAchieved && (
            <div className="mt-2 text-xs text-green-600">
              恭喜！今日签到条件已满足，可以去签到领奖励啦！
            </div>
          )}
        </div>
      </div>

      {/* 继续学习区域 */}
      {subjectId && (
        <div className="w-full max-w-xs mb-4">
          <div className="bg-gradient-to-r from-primary/10 to-purple-50 rounded-2xl p-4 border border-primary/20">
            <div className="flex items-center justify-between text-xs text-text-secondary mb-3">
              <span>第 {currentStage} 阶段完成</span>
              <span>→</span>
              <span className="text-primary font-medium">第 {nextStage} 阶段</span>
            </div>
            
            <div className="space-y-2">
              <button
                onClick={handlePreGenerate}
                disabled={generating}
                className="w-full bg-purple-500 text-white font-medium py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-70"
              >
                {generating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    AI生成中... {genProgress.current}/{genProgress.total}
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    预生成下一阶段题目
                  </>
                )}
              </button>
              
              <button
                onClick={handleContinueLearning}
                className="w-full bg-primary text-white font-medium py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md active:opacity-80"
              >
                <BookOpen size={16} />
                继续学习
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 查看解析按钮 - 用户点击才生成，节省token */}
      <div className="w-full max-w-xs mb-4">
        <button
          onClick={() => setShowExplanations(!showExplanations)}
          className="w-full bg-white border border-border rounded-xl p-3 text-sm flex items-center justify-center gap-2 text-text-secondary"
        >
          <FileText size={16} />
          {showExplanations ? '收起解析' : '查看AI解析'}
        </button>
        
        {showExplanations && (
          <div className="mt-2 bg-white rounded-xl border border-border p-4 space-y-4 max-h-96 overflow-y-auto">
            {stageQuestions.map((q, idx) => {
              const explanation = getSavedExplanation(q.id);
              const correctLabels = q.correctAnswers.map(a => {
                const optIdx = q.options.findIndex(o => o.id === a);
                return String.fromCharCode(65 + optIdx);
              });
              const relatedKP = state.knowledgePoints.find(kp => kp.id === q.knowledgePointId);
              const subject = state.subjects.find(s => s.id === q.subjectId);
              
              return (
                <div key={q.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                  <div className="text-sm font-medium text-text-primary mb-2">
                    {idx + 1}. {q.stem}
                  </div>
                  <div className="text-xs text-text-muted mb-2">
                    正确答案: <span className="font-medium">{correctLabels.join('、')}</span>
                  </div>
                  
                  {explanation ? (
                    <>
                      <div className="text-sm text-purple-700 bg-purple-50 rounded-lg p-3 mb-2">
                        <div className="font-medium mb-1">AI解析：</div>
                        {explanation}
                      </div>
                      {/* 追问按钮 - 解析看不懂可以继续问 */}
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            // 打开追问模态框或者跳转到聊天
                            navigate('ai-chat', { 
                              context: `关于这道题：${q.stem}，我对解析还有疑问，请进一步讲解`,
                              subjectId: q.subjectId,
                              knowledgePointId: q.knowledgePointId
                            });
                          }}
                          className="text-xs text-blue-600 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-blue-50"
                        >
                          <MessageSquare size={10} />
                          仍不理解，继续追问AI
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={async () => {
                        setGeneratingOne(q.id);
                        await generateExplanationOnDemand(
                          q.id,
                          { stem: q.stem, options: q.options },
                          [],
                          q.correctAnswers,
                          relatedKP?.name,
                          subject?.name
                        );
                        setGeneratingOne(null);
                      }}
                      disabled={generatingOne === q.id}
                      className="w-full py-2 bg-purple-100 text-purple-700 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {generatingOne === q.id ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          AI正在生成解析...
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} />
                          点击生成AI解析
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={() => navigate('quiz')}
          className="w-full bg-primary text-white font-medium py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md"
        >
          <RotateCcw size={16} />
          再练一次
        </button>

        <button
          onClick={() => navigate('home')}
          className="w-full bg-white text-text-secondary font-medium py-3 rounded-xl text-sm flex items-center justify-center gap-2 border border-border"
        >
          <Home size={16} />
          返回首页
        </button>

        {total - correct > 0 && (
          <button
            onClick={() => navigate('wrong-book')}
            className="w-full bg-red-50 text-red-600 font-medium py-3 rounded-xl text-sm flex items-center justify-center gap-2 border border-red-100"
          >
            查看错题 ({total - correct}题)
          </button>
        )}
      </div>
    </div>
  );
}
