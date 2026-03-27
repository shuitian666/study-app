import { useState, useMemo } from 'react';
import { useApp } from '@/store/AppContext';
import { PageHeader, ProficiencyBadge } from '@/components/ui/Common';
import { PROFICIENCY_MAP } from '@/types';
import type { ProficiencyLevel } from '@/types';
import { ChevronRight, Eye, EyeOff, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';

export default function ReviewSessionPage() {
  const { state, dispatch, navigate } = useApp();
  const reviewType = state.pageParams.type ?? 'review';
  const items = reviewType === 'review' ? state.todayReviewItems : state.todayNewItems;
  const pendingItems = items.filter(r => !r.completed);

  const knowledgePoints = useMemo(() =>
    pendingItems.map(item => state.knowledgePoints.find(k => k.id === item.knowledgePointId)).filter(Boolean),
    [pendingItems, state.knowledgePoints]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showNextOption, setShowNextOption] = useState(false);

  const currentKP = knowledgePoints[currentIndex];

  const handleRate = (level: ProficiencyLevel) => {
    if (!currentKP) return;
    dispatch({ type: 'UPDATE_PROFICIENCY', payload: { id: currentKP.id, proficiency: level } });
    dispatch({ type: 'COMPLETE_REVIEW_ITEM', payload: currentKP.id });
    setShowExplanation(false);
    setShowNextOption(true);
  };

  const handleNextAction = (action: 'continue' | 'next_stage' | 'quiz') => {
    setShowNextOption(false);
    
    if (action === 'continue') {
      if (currentIndex < knowledgePoints.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        // 当前阶段完成，检查是否有下一阶段
        const hasNewItems = state.todayNewItems.filter(r => !r.completed).length > 0;
        if (reviewType === 'review' && hasNewItems) {
          // 复习完成，自动进入新学
          navigate('review-session', { type: 'new' });
        } else {
          navigate('home');
        }
      }
    } else if (action === 'next_stage') {
      // 进入下一阶段学习
      const nextType = reviewType === 'review' ? 'new' : 'review';
      navigate('review-session', { type: nextType });
    } else if (action === 'quiz') {
      // 进入刷题
      if (currentKP) {
        navigate('quiz-session', { subjectId: currentKP.subjectId, knowledgePointId: currentKP.id });
      }
    }
  };

  if (knowledgePoints.length === 0) {
    // 检查是否有其他阶段可以继续
    const hasNewItems = reviewType === 'review' && state.todayNewItems.filter(r => !r.completed).length > 0;
    const hasReviewItems = reviewType === 'new' && state.todayReviewItems.filter(r => !r.completed).length > 0;
    
    return (
      <div>
        <PageHeader title={reviewType === 'review' ? '复习' : '新学'} onBack={() => navigate('home')} />
        <div className="flex flex-col items-center justify-center py-20 px-8">
          <span className="text-5xl mb-4">🎉</span>
          <p className="text-text-secondary font-medium">
            {reviewType === 'review' ? '今日复习已全部完成！' : '今日新学已全部完成！'}
          </p>
          <div className="flex gap-3 mt-4">
            {hasNewItems && (
              <button
                onClick={() => navigate('review-session', { type: 'new' })}
                className="bg-primary text-white px-6 py-2 rounded-xl text-sm"
              >
                继续新学
              </button>
            )}
            {hasReviewItems && (
              <button
                onClick={() => navigate('review-session', { type: 'review' })}
                className="bg-orange-500 text-white px-6 py-2 rounded-xl text-sm"
              >
                继续复习
              </button>
            )}
            <button
              onClick={() => navigate('home')}
              className="bg-gray-100 text-text-secondary px-6 py-2 rounded-xl text-sm"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentKP) return null;

  const subject = state.subjects.find(s => s.id === currentKP.subjectId);
  const relatedQuestions = state.questions.filter(q => q.knowledgePointId === currentKP.id);
  const isLastItem = currentIndex === knowledgePoints.length - 1;

  // 检查是否有下一阶段
  const nextStageLabel = reviewType === 'review' ? '新学内容' : '复习内容';
  const hasNextStage = reviewType === 'review' 
    ? state.todayNewItems.filter(r => !r.completed).length > 0
    : state.todayReviewItems.filter(r => !r.completed).length > 0;

  return (
    <div className="page-scroll pb-4">
      <PageHeader
        title={`${reviewType === 'review' ? '复习' : '新学'} ${currentIndex + 1}/${knowledgePoints.length}`}
        onBack={() => navigate('home')}
      />

      {/* Progress */}
      <div className="px-4 pt-2">
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / knowledgePoints.length) * 100}%` }}
          />
        </div>
      </div>


      {/* Knowledge Point Card */}
      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl p-5 border border-border shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-xs text-text-muted mb-1">{subject?.icon} {subject?.name}</div>
              <h2 className="text-xl font-bold">{currentKP.name}</h2>
            </div>
            <ProficiencyBadge level={currentKP.proficiency} />
          </div>

          {/* Show/Hide explanation */}
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="flex items-center gap-1.5 text-primary text-sm mb-3"
          >
            {showExplanation ? <EyeOff size={14} /> : <Eye size={14} />}
            {showExplanation ? '隐藏解释' : '显示解释'}
          </button>


          {showExplanation && (
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 mb-3">
              <p className="text-sm text-text-secondary leading-relaxed">{currentKP.explanation}</p>
            </div>

          )}

          {/* Related questions preview */}
          {relatedQuestions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="text-xs text-text-muted mb-2">关联例题</div>
              <button
                onClick={() => navigate('quiz-session', { subjectId: currentKP.subjectId, knowledgePointId: currentKP.id })}
                className="w-full bg-gray-50 rounded-lg p-3 text-left flex items-center justify-between"
              >
                <span className="text-xs text-text-secondary truncate">{relatedQuestions[0].stem}</span>
                <ChevronRight size={14} className="text-text-muted shrink-0" />
              </button>

            </div>

          )}
        </div>
      </div>


      {/* Next action options (after rating) */}
      {showNextOption ? (
        <div className="px-4 pt-6">
          <h3 className="text-sm font-semibold text-center mb-4">接下来你想做什么？</h3>
          <div className="space-y-3">
            {/* 继续当前阶段 */}
            <button
              onClick={() => handleNextAction('continue')}
              className="w-full bg-white rounded-xl p-4 border border-border shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <ArrowRight size={18} className="text-primary" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm">{isLastItem ? '完成学习' : '继续学习'}</div>
                  <div className="text-xs text-text-muted">{isLastItem ? `已完成 ${knowledgePoints.length} 个知识点` : '下一个知识点'}</div>
                </div>
              </div>
              <ChevronRight size={16} className="text-text-muted" />
            </button>

            {/* 刷题巩固 */}
            {relatedQuestions.length > 0 && (
              <button
                onClick={() => handleNextAction('quiz')}
                className="w-full bg-white rounded-xl p-4 border border-border shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Sparkles size={18} className="text-green-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">刷题巩固</div>
                    <div className="text-xs text-text-muted">练习 {relatedQuestions.length} 道相关题目</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-text-muted" />
              </button>
            )}

            {/* 进入下一阶段 */}
            {hasNextStage && (
              <button
                onClick={() => handleNextAction('next_stage')}
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl p-4 shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform text-white"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <ArrowRight size={18} />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">继续{nextStageLabel}</div>
                    <div className="text-xs text-white/80">
                      {reviewType === 'review' ? `${state.todayNewItems.filter(r => !r.completed).length} 个新知识点待学习` : '复习更多内容'}
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-white/60" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Self-rating */}
          <div className="px-4 pt-6">
            <h3 className="text-sm font-semibold text-center mb-3">你对这个知识点的掌握程度？</h3>
            <div className="grid grid-cols-4 gap-2">
              {(['none', 'rusty', 'normal', 'master'] as ProficiencyLevel[]).map(level => {
                const config = PROFICIENCY_MAP[level];
                return (
                  <button
                    key={level}
                    onClick={() => handleRate(level)}
                    className="rounded-xl p-3 text-center border-2 border-transparent transition-all active:scale-95"
                    style={{ backgroundColor: config.bgColor }}
                  >
                    <div className="text-lg mb-0.5">
                      {level === 'none' ? '😵' : level === 'rusty' ? '🤔' : level === 'normal' ? '😊' : '😎'}
                    </div>

                    <div className="text-xs font-medium" style={{ color: config.color }}>
                      {config.label}
                    </div>

                  </button>
                );
              })}
            </div>
          </div>


          {/* Quick complete */}
          <div className="px-4 pt-4 pb-8">
            <button
              onClick={() => handleRate(currentKP.proficiency)}
              className="w-full bg-gray-100 text-text-muted text-xs py-2.5 rounded-xl flex items-center justify-center gap-1"
            >
              <CheckCircle size={12} />
              保持当前熟练度，跳过
            </button>

          </div>
        </>
      )}
    </div>
  );
}
