import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { PageHeader, EmptyState } from '@/components/ui/Common';
import { Play, RotateCcw, AlertCircle, BookOpen, Sparkles, Compass } from 'lucide-react';

export type LearningIntention = 'mixed' | 'new' | 'review' | 'weak' | 'custom';

export default function QuizPage() {
  const { state, navigate } = useApp();
  const [selectedIntention, setSelectedIntention] = useState<LearningIntention>('mixed');

  const subjectsWithQuestions = state.subjects.filter(s =>
    state.questions.some(q => q.subjectId === s.id)
  );

  return (
    <div className="page-scroll pb-20">
      <PageHeader title="刷题中心" />

      {/* Wrong Book Entry */}
      {state.wrongRecords.length > 0 && (
        <div className="px-4 pt-3">
          <button
            onClick={() => navigate('wrong-book')}
            className="w-full bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl p-5 border border-red-100 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle size={24} className="text-red-500" />
              </div>
              <div className="text-left">
                <div className="text-base font-semibold text-red-800">错题本</div>
                <div className="text-sm text-red-500 mt-0.5">{state.wrongRecords.length} 道错题等待复习</div>
              </div>
            </div>
            <RotateCcw size={20} className="text-red-400" />
          </button>
        </div>
      )}

      {/* 学习倾向选择 - 用户可以指定今天学习重点 */}
      <div className="px-4 pt-5">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-4 border border-blue-100 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Compass size={16} className="text-blue-600" />
            <h3 className="text-sm font-semibold text-blue-800">今日学习倾向</h3>
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
                className={`p-2 rounded-xl border text-left transition-all ${
                  selectedIntention === key
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-blue-200 text-text-primary'
                }`}
              >
                <div className="text-sm font-medium">{label}</div>
                <div className={`text-xs ${selectedIntention === key ? 'text-blue-100' : 'text-text-muted'}`}>
                  {desc}
                </div>
              </button>
            ))}
          </div>
          {selectedIntention !== 'mixed' && (
            <div className="mt-2 text-xs text-blue-600 flex items-center gap-1">
              <Sparkles size={12} />
              AI会根据你的学习倾向智能调整出题优先级
            </div>
          )}
        </div>

        <h3 className="text-base font-semibold mb-4">选择学科开始测试</h3>

        {subjectsWithQuestions.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={48} className="text-gray-300 mx-auto" />}
            title="暂无题目"
            description="请先添加知识点和题目"
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {subjectsWithQuestions.map(subject => {
              const questionCount = state.questions.filter(q => q.subjectId === subject.id).length;
              const kpCount = state.knowledgePoints.filter(k => k.subjectId === subject.id).length;
              return (
                <button
                  key={subject.id}
                  onClick={() => navigate('quiz-session', { subjectId: subject.id })}
                  className="w-full bg-white rounded-2xl p-5 border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex items-center justify-between active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                      style={{ backgroundColor: subject.color + '15', color: subject.color }}
                    >
                      {subject.icon}
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-base">{subject.name}</div>
                      <div className="text-sm text-text-muted mt-1">
                        {questionCount} 道题 · {kpCount} 个知识点
                      </div>
                    </div>
                  </div>
                  <div className="bg-primary/10 p-3 rounded-full">
                    <Play size={20} className="text-primary" fill="currentColor" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Quiz Results */}
      {state.quizResults.length > 0 && (
        <div className="px-4 mt-6 mb-8">
          <h3 className="text-base font-semibold mb-4">最近测试记录</h3>
          <div className="space-y-3">
            {state.quizResults.slice(-5).reverse().map(result => {
              const subject = state.subjects.find(s => s.id === result.subjectId);
              const percentage = (result.correctCount / result.totalQuestions) * 100;
              return (
                <div key={result.id} className="bg-white rounded-2xl p-4 border border-border shadow-sm flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{subject?.icon} {subject?.name}</div>
                    <div className="text-xs text-text-muted mt-0.5">
                      {result.correctCount}/{result.totalQuestions} 题正确
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`h-full rounded-full ${percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className={`text-xl font-bold ml-4 px-3 py-1 rounded-xl ${result.score >= 80 ? 'bg-green-50 text-green-600' : result.score >= 60 ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'}`}>
                    {result.score}
                    <span className="text-xs font-normal">分</span>
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
