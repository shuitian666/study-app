import { useApp } from '@/store/AppContext';
import { PageHeader, EmptyState } from '@/components/ui/Common';
import { Trash2, CheckCircle } from 'lucide-react';

export default function WrongBookPage() {
  const { state, dispatch, navigate } = useApp();

  const wrongRecords = state.wrongRecords.map(wr => {
    const question = state.questions.find(q => q.id === wr.questionId);
    const kp = question ? state.knowledgePoints.find(k => k.id === question.knowledgePointId) : null;
    return { ...wr, question, kp };
  });

  return (
    <div className="page-scroll pb-4">
      <PageHeader title={`错题本 (${wrongRecords.length})`} onBack={() => navigate('quiz')} />

      <div className="px-4 pt-4">
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
                <div key={wr.id} className="bg-white rounded-2xl p-4 border border-border shadow-sm">
                  {wr.kp && (
                    <div className="text-[10px] text-text-muted mb-1.5">
                      知识点：{wr.kp.name}
                    </div>
                  )}
                  <p className="text-sm font-medium mb-3">{wr.question.stem}</p>

                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-start gap-1.5">
                      <span className="text-red-500 text-xs shrink-0 mt-0.5">✗ 你的答案：</span>
                      <span className="text-xs text-red-600">{wrongTexts.join(', ')}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <CheckCircle size={12} className="text-green-500 shrink-0 mt-0.5" />
                      <span className="text-xs text-green-600">{correctTexts.join(', ')}</span>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-2.5 mb-3">
                    <p className="text-xs text-text-secondary">{wr.question.explanation}</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => dispatch({ type: 'REMOVE_WRONG_RECORD', payload: wr.id })}
                      className="flex-1 bg-red-50 text-red-500 text-xs py-2 rounded-lg flex items-center justify-center gap-1"
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
