import { useState, useEffect } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { PageHeader, EmptyState } from '@/components/ui/Common';
import { Trash2, CheckCircle } from 'lucide-react';

export default function WrongBookPage() {
  const { navigate } = useUser();
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

  const wrongRecords = learningState.wrongRecords.map(wr => {
    const question = learningState.questions.find(q => q.id === wr.questionId);
    const kp = question ? learningState.knowledgePoints.find(k => k.id === question.knowledgePointId) : null;
    return { ...wr, question, kp };
  });

  return (
    <div className="page-scroll pb-4">
      <PageHeader title={`错题本 (${wrongRecords.length})`} onBack={() => navigate('quiz')} />

      <div className={`px-4 pt-4 ${getAnimationClass(1)}`}>
        {wrongRecords.length === 0 ? (
          <EmptyState icon="🎉" title="没有错题" description="太棒了，继续保持！" />
        ) : (
          <div className="space-y-3">
            {wrongRecords.map(wr => {
              if (!wr.question) return null;
              const correctTexts = wr.question.options
                .filter(o => wr.correctAnswers.includes(o.id))
                .map(o => o.text);
              const wrongTexts = wr.question.options
                .filter(o => wr.wrongAnswers.includes(o.id))
                .map(o => o.text);

              return (
                <div key={wr.id} className="rounded-2xl p-4 border shadow-sm" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
                  {wr.kp && (
                    <div className="text-[10px] mb-1.5" style={{ color: theme.textMuted }}>
                      知识点：{wr.kp.name}
                    </div>
                  )}
                  <p className="text-sm font-medium mb-3" style={{ color: theme.textPrimary }}>{wr.question.stem}</p>

                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-start gap-1.5">
                      <span className="text-xs shrink-0 mt-0.5" style={{ color: '#f87171' }}>✗ 你的答案：</span>
                      <span className="text-xs" style={{ color: '#dc2626' }}>{wrongTexts.join(', ')}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <CheckCircle size={12} className="shrink-0 mt-0.5" style={{ color: '#22c55e' }} />
                      <span className="text-xs" style={{ color: '#16a34a' }}>{correctTexts.join(', ')}</span>
                    </div>
                  </div>

                  <div className="rounded-lg p-2.5 mb-3" style={{ backgroundColor: theme.border }}>
                    <p className="text-xs" style={{ color: theme.textSecondary }}>{wr.question.explanation}</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => learningDispatch({ type: 'REMOVE_WRONG_RECORD', payload: wr.id })}
                      className="flex-1 text-xs py-2 rounded-lg flex items-center justify-center gap-1"
                      style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}
                    >
                      <Trash2 size={12} />
                      移除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
