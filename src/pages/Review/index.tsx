import { useState, useMemo, useEffect, useRef } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { PageHeader, ProficiencyBadge } from '@/components/ui/Common';
import { PROFICIENCY_MAP } from '@/types';
import type { ProficiencyLevel } from '@/types';
import { ChevronRight, Eye, EyeOff, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';

export default function ReviewSessionPage() {
  const { userState, navigate } = useUser();
  const { learningState, learningDispatch } = useLearning();
  const { theme } = useTheme();

  // 动画效果 - 使用次级界面动画设置
  const [animationEffect, setAnimationEffect] = useState(() => {
    const saved = localStorage.getItem('sub-animation-effect');
    return saved || 'fade-in';
  });

  // 监听动画效果变化
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sub-animation-effect' && e.newValue) {
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

  const reviewType = userState.pageParams.type ?? 'review';
  const items = reviewType === 'review' ? learningState.todayReviewItems : learningState.todayNewItems;
  const pendingItems = items.filter(r => !r.completed);

  const knowledgePoints = useMemo(() =>
    pendingItems.map(item => learningState.knowledgePoints.find(k => k.id === item.knowledgePointId)).filter(Boolean),
    [pendingItems, learningState.knowledgePoints]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showNextOption, setShowNextOption] = useState(false);
  const hasAutoNavigated = useRef(false);

  const hasNewItems = learningState.todayNewItems.filter(r => !r.completed).length > 0;
  const hasReviewItems = learningState.todayReviewItems.filter(r => !r.completed).length > 0;

  useEffect(() => {
    if (userState.currentPage !== 'review-session') return;
    if (hasAutoNavigated.current) return;

    if (knowledgePoints.length === 0) {
      hasAutoNavigated.current = true;
      if (reviewType === 'review' && hasNewItems) {
        navigate('review-session', { type: 'new' });
      } else if (reviewType === 'new' && hasReviewItems) {
        navigate('review-session', { type: 'review' });
      }
    }

    return () => {
      hasAutoNavigated.current = false;
    };
  }, [knowledgePoints.length, reviewType, hasNewItems, hasReviewItems, navigate, userState.currentPage]);

  useEffect(() => {
    if (currentIndex >= knowledgePoints.length && knowledgePoints.length > 0) {
      setCurrentIndex(knowledgePoints.length - 1);
    } else if (knowledgePoints.length === 0) {
      setCurrentIndex(0);
    }
  }, [knowledgePoints.length]);

  const currentKP = knowledgePoints[currentIndex];

  const handleRate = (level: ProficiencyLevel) => {
    if (!currentKP) return;
    learningDispatch({ type: 'UPDATE_PROFICIENCY', payload: { id: currentKP.id, proficiency: level } });
    learningDispatch({ type: 'COMPLETE_REVIEW_ITEM', payload: currentKP.id });
    setShowExplanation(false);
    setShowNextOption(true);
    hasAutoNavigated.current = false;
  };

  const handleNextAction = (action: 'continue' | 'next_stage' | 'quiz') => {
    setShowNextOption(false);

    if (action === 'continue') {
      if (currentIndex < knowledgePoints.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        const hasNewItems = learningState.todayNewItems.filter(r => !r.completed).length > 0;
        if (reviewType === 'review' && hasNewItems) {
          navigate('review-session', { type: 'new' });
        } else {
          navigate('home');
        }
      }
    } else if (action === 'next_stage') {
      const nextType = reviewType === 'review' ? 'new' : 'review';
      navigate('review-session', { type: nextType });
    } else if (action === 'quiz') {
      if (currentKP) {
        navigate('quiz-session', { subjectId: currentKP.subjectId, knowledgePointId: currentKP.id });
      }
    }
    hasAutoNavigated.current = false;
  };

  if (knowledgePoints.length === 0) {
    return (
      <div>
        <PageHeader title={reviewType === 'review' ? '复习' : '新学'} onBack={() => navigate('home')} />
        <div className="flex flex-col items-center justify-center py-20 px-8">
          <span className="text-5xl mb-4">🎉</span>
          <p className="font-medium" style={{ color: theme.textSecondary }}>
            {reviewType === 'review' ? '今日复习已全部完成！' : '今日新学已全部完成！'}
          </p>
          <button
            onClick={() => navigate('home')}
            className="mt-4 px-6 py-2 rounded-xl text-sm"
            style={{ backgroundColor: theme.primary, color: '#ffffff' }}
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  if (!currentKP) {
    setCurrentIndex(0);
    return (
      <div>
        <PageHeader title="加载中..." onBack={() => navigate('home')} />
        <div className="flex flex-col items-center justify-center py-20 px-8">
          <span className="text-5xl mb-4">⏳</span>
          <p className="font-medium" style={{ color: theme.textSecondary }}>正在加载...</p>
        </div>
      </div>
    );
  }

  const subject = learningState.subjects.find(s => s.id === currentKP.subjectId);
  const relatedQuestions = learningState.questions.filter(q => q.knowledgePointId === currentKP.id);
  const isLastItem = currentIndex === knowledgePoints.length - 1;
  const nextStageLabel = reviewType === 'review' ? '新学内容' : '复习内容';
  const hasNextStage = reviewType === 'review'
    ? learningState.todayNewItems.filter(r => !r.completed).length > 0
    : learningState.todayReviewItems.filter(r => !r.completed).length > 0;

  return (
    <div className="page-scroll pb-4">
      <PageHeader
        title={`${reviewType === 'review' ? '复习' : '新学'} ${currentIndex + 1}/${knowledgePoints.length}`}
        onBack={() => navigate('home')}
      />

      <div className={`px-4 pt-2 ${getAnimationClass(1)}`}>
        <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ backgroundColor: theme.border }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / knowledgePoints.length) * 100}%`, backgroundColor: theme.primary }}
          />
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="rounded-2xl p-5 border shadow-sm" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
          <div className="flex items-start justify-between mb-3 gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs mb-1 truncate" style={{ color: theme.textMuted }}>{subject?.icon} {subject?.name}</div>
              <h2 className="text-xl font-bold truncate" style={{ color: theme.textPrimary }}>{currentKP.name}</h2>
            </div>
            <ProficiencyBadge level={currentKP.proficiency} />
          </div>

          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="flex items-center gap-1.5 text-sm mb-3"
            style={{ color: theme.primary }}
          >
            {showExplanation ? <EyeOff size={14} /> : <Eye size={14} />}
            {showExplanation ? '隐藏解释' : '显示解释'}
          </button>

          {showExplanation && (
            <div className="rounded-xl p-4 border mb-3" style={{ backgroundColor: `${theme.primary}15`, borderColor: `${theme.primary}30` }}>
              <p className="text-sm leading-relaxed" style={{ color: theme.textSecondary }}>{currentKP.explanation}</p>
            </div>
          )}

          {relatedQuestions.length > 0 && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: theme.border }}>
              <div className="text-xs mb-2" style={{ color: theme.textMuted }}>关联例题</div>
              <button
                onClick={() => navigate('quiz-session', { subjectId: currentKP.subjectId, knowledgePointId: currentKP.id })}
                className="w-full rounded-lg p-3 text-left flex items-center justify-between"
                style={{ backgroundColor: theme.border }}
              >
                <span className="text-xs truncate" style={{ color: theme.textSecondary }}>{relatedQuestions[0].stem}</span>
                <ChevronRight size={14} style={{ color: theme.textMuted }} />
              </button>
            </div>
          )}
        </div>
      </div>

      {showNextOption ? (
        <div className="px-4 pt-6">
          <h3 className="text-sm font-semibold text-center mb-4" style={{ color: theme.textPrimary }}>接下来你想做什么？</h3>
          <div className="space-y-3">
            <button
              onClick={() => handleNextAction('continue')}
              className="w-full rounded-xl p-4 border shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform"
              style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${theme.primary}1a` }}>
                  <ArrowRight size={18} style={{ color: theme.primary }} />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>{isLastItem ? '完成学习' : '继续学习'}</div>
                  <div className="text-xs" style={{ color: theme.textMuted }}>{isLastItem ? `已完成 ${knowledgePoints.length} 个知识点` : '下一个知识点'}</div>
                </div>
              </div>
              <ChevronRight size={16} style={{ color: theme.textMuted }} />
            </button>

            {relatedQuestions.length > 0 && (
              <button
                onClick={() => handleNextAction('quiz')}
                className="w-full rounded-xl p-4 border shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform"
                style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${theme.success}20` }}>
                    <Sparkles size={18} style={{ color: theme.success }} />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm" style={{ color: theme.textPrimary }}>刷题巩固</div>
                    <div className="text-xs" style={{ color: theme.textMuted }}>练习 {relatedQuestions.length} 道相关题目</div>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: theme.textMuted }} />
              </button>
            )}

            {hasNextStage && (
              <button
                onClick={() => handleNextAction('next_stage')}
                className="w-full rounded-xl p-4 shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform text-white"
                style={{ background: `linear-gradient(to right, ${theme.primary}, ${theme.primaryLight})` }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                    <ArrowRight size={18} />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">继续{nextStageLabel}</div>
                    <div className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                      {reviewType === 'review' ? `${learningState.todayNewItems.filter(r => !r.completed).length} 个新知识点待学习` : '复习更多内容'}
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: 'rgba(255, 255, 255, 0.6)' }} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="px-4 pt-6">
            <h3 className="text-sm font-semibold text-center mb-3" style={{ color: theme.textPrimary }}>你对这个知识点的掌握程度？</h3>
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

          <div className="px-4 pt-4 pb-8">
            <button
              onClick={() => handleRate(currentKP.proficiency)}
              className="w-full text-xs py-2.5 rounded-xl flex items-center justify-center gap-1"
              style={{ backgroundColor: theme.border, color: theme.textMuted }}
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
