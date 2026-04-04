import { useState, useEffect } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { PageHeader, EmptyState } from '@/components/ui/Common';
import { Play, RotateCcw, AlertCircle, BookOpen, Sparkles, Compass } from 'lucide-react';

export type LearningIntention = 'mixed' | 'new' | 'review' | 'weak' | 'custom';

export default function QuizPage() {
  const { navigate } = useUser();
  const { learningState } = useLearning();
  const { theme } = useTheme();
  const [selectedIntention, setSelectedIntention] = useState<LearningIntention>('mixed');
  const [animationEffect, setAnimationEffect] = useState<string>('slide-up');

  useEffect(() => {
    const savedEffect = localStorage.getItem('main-animation-effect');
    if (savedEffect) {
      setAnimationEffect(savedEffect);
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'main-animation-effect' && e.newValue) {
        setAnimationEffect(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const getAnimationClass = (index: number) => {
    switch (animationEffect) {
      case 'fade-in':
        return `scroll-fade-in delay-${index}`;
      case 'scale-in':
        return `scroll-scale-in delay-${index}`;
      case 'rotate-in':
        return `scroll-rotate-in delay-${index}`;
      case 'bounce-in':
        return `scroll-bounce-in delay-${index}`;
      case 'slide-left':
        return `scroll-slide-left delay-${index}`;
      case 'slide-right':
        return `scroll-slide-right delay-${index}`;
      case 'slide-up':
      default:
        return `scroll-slide-up delay-${index}`;
    }
  };

  const subjectsWithQuestions = learningState.subjects.filter(s =>
    learningState.questions.some(q => q.subjectId === s.id)
  );

  return (
    <div className="page-scroll pb-20">
      <PageHeader title="刷题中心" />

      {/* Wrong Book Entry */}
      {learningState.wrongRecords.length > 0 && (
        <div className={`px-4 pt-3 ${getAnimationClass(1)}`}>
          <button
            onClick={() => navigate('wrong-book')}
            className="w-full rounded-2xl p-5 border shadow-sm hover:shadow-md transition-shadow flex items-center justify-between active:scale-[0.98]"
            style={{ 
              background: 'linear-gradient(90deg, #fee2e2 0%, #fed7aa 100%)',
              borderColor: '#fecaca'
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#fecaca' }}>
                <AlertCircle size={24} style={{ color: '#dc2626' }} />
              </div>
              <div className="text-left">
                <div className="text-base font-semibold" style={{ color: '#991b1b' }}>错题本</div>
                <div className="text-sm mt-0.5" style={{ color: '#dc2626' }}>{learningState.wrongRecords.length} 道错题等待复习</div>
              </div>
            </div>
            <RotateCcw size={20} style={{ color: '#f87171' }} />
          </button>
        </div>
      )}

      {/* 学习倾向选择 - 用户可以指定今天学习重点 */}
      <div className={`px-4 pt-5 ${getAnimationClass(2)}`}>
        <div className="rounded-2xl p-4 border mb-5" style={{ 
          background: 'linear-gradient(90deg, #eff6ff 0%, #f5f3ff 100%)',
          borderColor: '#dbeafe'
        }}>
          <div className="flex items-center gap-2 mb-3">
            <Compass size={16} style={{ color: '#2563eb' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#1e40af' }}>今日学习倾向</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'mixed', label: '混合练习', desc: '新知识点+复习' },
              { key: 'new', label: '学习新知识点', desc: '优先新内容' },
              { key: 'review', label: '复习旧知识点', desc: '根据遗忘曲线' },
              { key: 'weak', label: '强化薄弱点', desc: '错题+未掌握' },
            ] as const).map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => setSelectedIntention(key)}
                className="p-2 rounded-xl border text-left transition-all"
                style={{
                  backgroundColor: selectedIntention === key ? '#2563eb' : theme.bgCard,
                  borderColor: selectedIntention === key ? '#2563eb' : '#dbeafe',
                  color: selectedIntention === key ? '#ffffff' : theme.textPrimary
                }}
              >
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs" style={{ color: selectedIntention === key ? '#bfdbfe' : theme.textMuted }}>
                  {desc}
                </div>
              </button>
            ))}
          </div>
          {selectedIntention !== 'mixed' && (
            <div className="mt-2 text-xs flex items-center gap-1" style={{ color: '#2563eb' }}>
              <Sparkles size={12} />
              AI会根据你的学习倾向智能调整出题优先级
            </div>
          )}
        </div>

        <h3 className="text-base font-semibold mb-4" style={{ color: theme.textPrimary }}>选择学科开始测试</h3>

        {subjectsWithQuestions.length === 0 ? (
          <div className={getAnimationClass(3)}>
            <EmptyState
              icon={<BookOpen size={48} style={{ color: theme.textMuted }} className="mx-auto" />}
              title="暂无题目"
              description="请先添加知识点和题目"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {subjectsWithQuestions.map((subject, index) => {
              const questionCount = learningState.questions.filter(q => q.subjectId === subject.id).length;
              const kpCount = learningState.knowledgePoints.filter(k => k.subjectId === subject.id).length;
              return (
                <div key={subject.id} className={getAnimationClass(3 + index)}>
                  <button
                    onClick={() => navigate('quiz-session', { subjectId: subject.id })}
                    className="w-full rounded-2xl p-5 border shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex items-center justify-between active:scale-[0.98]"
                    style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                        style={{ backgroundColor: subject.color + '15', color: subject.color }}
                      >
                        {subject.icon}
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-base" style={{ color: theme.textPrimary }}>{subject.name}</div>
                        <div className="text-sm mt-1" style={{ color: theme.textMuted }}>
                          {questionCount} 道题 · {kpCount} 个知识点
                        </div>
                      </div>
                    </div>
                    <div className="p-3 rounded-full" style={{ backgroundColor: `${theme.primary}10` }}>
                      <Play size={20} style={{ color: theme.primary }} fill="currentColor" />
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Quiz Results */}
      {learningState.quizResults.length > 0 && (
        <div className={`px-4 mt-6 mb-8 ${getAnimationClass(4)}`}>
          <h3 className="text-base font-semibold mb-4" style={{ color: theme.textPrimary }}>最近测试记录</h3>
          <div className="space-y-3">
            {learningState.quizResults.slice(-5).reverse().map((result, index) => {
              const subject = learningState.subjects.find(s => s.id === result.subjectId);
              const percentage = (result.correctCount / result.totalQuestions) * 100;
              return (
                <div key={result.id} className={getAnimationClass(5 + index)}>
                  <div className="rounded-2xl p-4 border shadow-sm flex items-center justify-between" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
                    <div className="flex-1">
                      <div className="text-sm font-semibold" style={{ color: theme.textPrimary }}>{subject?.icon} {subject?.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
                        {result.correctCount}/{result.totalQuestions} 题正确
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 w-full rounded-full h-1.5" style={{ backgroundColor: theme.border }}>
                        <div
                          className="h-full rounded-full"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: percentage >= 80 ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#ef4444'
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-xl font-bold ml-4 px-3 py-1 rounded-xl" style={{
                      backgroundColor: result.score >= 80 ? '#d1fae5' : result.score >= 60 ? '#fef3c7' : '#fee2e2',
                      color: result.score >= 80 ? '#059669' : result.score >= 60 ? '#d97706' : '#dc2626'
                    }}>
                      {result.score}
                      <span className="text-xs font-normal">分</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
