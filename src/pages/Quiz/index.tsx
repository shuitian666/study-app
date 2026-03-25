import { useApp } from '@/store/AppContext';
import { PageHeader, EmptyState } from '@/components/ui/Common';
import { Play, RotateCcw, AlertCircle } from 'lucide-react';

export default function QuizPage() {
  const { state, navigate } = useApp();

  const subjectsWithQuestions = state.subjects.filter(s =>
    state.questions.some(q => q.subjectId === s.id)
  );

  return (
    <div className="page-scroll pb-4">
      <PageHeader title="刷题中心" />

      {/* Wrong Book Entry */}
      {state.wrongRecords.length > 0 && (
        <div className="px-4 pt-3">
          <button
            onClick={() => navigate('wrong-book')}
            className="w-full bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl p-4 border border-red-100 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle size={20} className="text-red-500" />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-red-700">错题本</div>
                <div className="text-xs text-red-400">{state.wrongRecords.length} 道错题等待复习</div>
              </div>
            </div>
            <RotateCcw size={16} className="text-red-400" />
          </button>
        </div>
      )}

      {/* Subject Selection */}
      <div className="px-4 pt-4">
        <h3 className="text-sm font-semibold mb-3">选择学科开始测试</h3>

        {subjectsWithQuestions.length === 0 ? (
          <EmptyState icon="📝" title="暂无题目" description="请先添加知识点和题目" />
        ) : (
          <div className="space-y-3">
            {subjectsWithQuestions.map(subject => {
              const questionCount = state.questions.filter(q => q.subjectId === subject.id).length;
              const kpCount = state.knowledgePoints.filter(k => k.subjectId === subject.id).length;
              return (
                <button
                  key={subject.id}
                  onClick={() => navigate('quiz-session', { subjectId: subject.id })}
                  className="w-full bg-white rounded-2xl p-4 border border-border shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                      style={{ backgroundColor: subject.color + '15' }}
                    >
                      {subject.icon}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-sm">{subject.name}</div>
                      <div className="text-xs text-text-muted mt-0.5">
                        {questionCount} 道题 · {kpCount} 个知识点
                      </div>
                    </div>
                  </div>
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Play size={16} className="text-primary" fill="currentColor" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Quiz Results */}
      {state.quizResults.length > 0 && (
        <div className="px-4 mt-6">
          <h3 className="text-sm font-semibold mb-3">最近测试记录</h3>
          <div className="space-y-2">
            {state.quizResults.slice(-5).reverse().map(result => {
              const subject = state.subjects.find(s => s.id === result.subjectId);
              return (
                <div key={result.id} className="bg-white rounded-xl p-3 border border-border shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{subject?.icon} {subject?.name}</div>
                    <div className="text-xs text-text-muted mt-0.5">
                      {result.correctCount}/{result.totalQuestions} 题正确
                    </div>
                  </div>
                  <div className={`text-lg font-bold ${result.score >= 80 ? 'text-accent' : result.score >= 60 ? 'text-warning' : 'text-danger'}`}>
                    {result.score}分
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
