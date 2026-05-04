import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { PageHeader, EmptyState } from '@/components/ui/Common';
import { Play, RotateCcw, AlertCircle, BookOpen, Sparkles, Compass, Brain, Target } from 'lucide-react';
import { TopAppBar, FloatingAIPanel } from '@/components/layout';

export type LearningIntention = 'mixed' | 'new' | 'review' | 'weak' | 'custom';

export default function QuizPage() {
  const { navigate } = useUser();
  const { learningState } = useLearning();
  const { theme } = useTheme();
  const [selectedIntention, setSelectedIntention] = useState<LearningIntention>('mixed');
  const [animationEffect, setAnimationEffect] = useState<string>('slide-up');

  const uiStyle = theme.uiStyle || 'playful';

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

  // 计算统计数据
  const stats = useMemo(() => {
    const totalQuizzes = learningState.quizResults.length;
    const totalQuestions = learningState.quizResults.reduce((sum, r) => sum + r.totalQuestions, 0);
    const correctQuestions = learningState.quizResults.reduce((sum, r) => sum + r.correctCount, 0);
    const accuracy = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0;
    return { totalQuizzes, totalQuestions, correctQuestions, accuracy };
  }, [learningState.quizResults]);

  // ===== Scholar 风格渲染 =====
  if (uiStyle === 'scholar') {
    return (
      <div className="page-scroll" style={{ backgroundColor: theme.bg || '#f8f9fa' }}>
        <TopAppBar />

        <div className="px-6 pt-6 space-y-6 pb-32">
          {/* Page Title */}
          <div>
            <h2
              className="text-2xl font-bold mb-1"
              style={{ color: theme.textPrimary, fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              刷题中心
            </h2>
            <p className="text-sm" style={{ color: theme.textSecondary }}>巩固知识，检验学习成果</p>
          </div>

          {/* Stats Bento Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Wrong Count */}
            <div
              className="col-span-1 p-4 rounded-2xl flex flex-col items-center justify-center"
              style={{
                backgroundColor: theme.surfaceContainerLowest || '#ffffff',
                boxShadow: 'none',
              }}
            >
              <div
                className="p-2 rounded-xl mb-2"
                style={{ backgroundColor: theme.errorContainer || '#ffdad6' }}
              >
                <AlertCircle size={18} style={{ color: theme.error || '#ba1a1a' }} />
              </div>
              <span className="text-xl font-bold" style={{ color: theme.onSurface || '#191c1d' }}>
                {learningState.wrongRecords.length}
              </span>
              <span className="text-xs" style={{ color: theme.onSurfaceVariant || '#454652' }}>错题数</span>
            </div>

            {/* Total Quizzes */}
            <div
              className="col-span-1 p-4 rounded-2xl flex flex-col items-center justify-center"
              style={{
                backgroundColor: theme.surfaceContainerLowest || '#ffffff',
                boxShadow: 'none',
              }}
            >
              <div
                className="p-2 rounded-xl mb-2"
                style={{ backgroundColor: theme.primaryFixed || '#dee0ff' }}
              >
                <Brain size={18} style={{ color: theme.primary || '#24389c' }} />
              </div>
              <span className="text-xl font-bold" style={{ color: theme.onSurface || '#191c1d' }}>
                {stats.totalQuizzes}
              </span>
              <span className="text-xs" style={{ color: theme.onSurfaceVariant || '#454652' }}>总测试</span>
            </div>

            {/* Accuracy */}
            <div
              className="col-span-1 p-4 rounded-2xl flex flex-col items-center justify-center"
              style={{
                backgroundColor: theme.surfaceContainerLowest || '#ffffff',
                boxShadow: 'none',
              }}
            >
              <div
                className="p-2 rounded-xl mb-2"
                style={{ backgroundColor: theme.secondaryFixed || '#ffdfa0' }}
              >
                <Target size={18} style={{ color: theme.secondary || '#795900' }} />
              </div>
              <span className="text-xl font-bold" style={{ color: theme.onSurface || '#191c1d' }}>
                {stats.accuracy}%
              </span>
              <span className="text-xs" style={{ color: theme.onSurfaceVariant || '#454652' }}>正确率</span>
            </div>
          </div>

          {/* Wrong Book Entry */}
          {learningState.wrongRecords.length > 0 && (
            <button
              onClick={() => navigate('wrong-book')}
              className="w-full rounded-2xl p-4 border flex items-center justify-between active:scale-[0.98] transition-transform"
              style={{
                backgroundColor: theme.surfaceContainerLowest || '#ffffff',
                borderColor: theme.outlineVariant || '#c5c5d4',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: theme.errorContainer || '#ffdad6' }}
                >
                  <AlertCircle size={20} style={{ color: theme.error || '#ba1a1a' }} />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold" style={{ color: theme.onSurface || '#191c1d' }}>错题本</div>
                  <div className="text-xs" style={{ color: theme.onSurfaceVariant || '#454652' }}>
                    {learningState.wrongRecords.length} 道错题等待复习
                  </div>
                </div>
              </div>
              <RotateCcw size={18} style={{ color: theme.onSurfaceVariant || '#454652' }} />
            </button>
          )}

          {/* Learning Intention */}
          <div
            className="p-4 rounded-2xl"
            style={{
              backgroundColor: theme.surfaceContainerLowest || '#ffffff',
              boxShadow: 'none',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Compass size={16} style={{ color: theme.primary || '#24389c' }} />
              <h3 className="text-sm font-semibold" style={{ color: theme.onSurface || '#191c1d' }}>学习倾向</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: 'mixed', label: '混合' },
                { key: 'new', label: '新知识' },
                { key: 'review', label: '复习' },
                { key: 'weak', label: '薄弱点' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSelectedIntention(key)}
                  className="p-2 rounded-xl border text-center transition-all text-sm"
                  style={{
                    backgroundColor: selectedIntention === key ? theme.primary : 'transparent',
                    borderColor: selectedIntention === key ? theme.primary : theme.outlineVariant || '#c5c5d4',
                    color: selectedIntention === key ? '#ffffff' : theme.onSurfaceVariant || '#454652',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject Cards */}
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: theme.onSurface || '#191c1d' }}>
              选择学科
            </h3>
            {subjectsWithQuestions.length === 0 ? (
              <div
                className="p-8 rounded-2xl text-center"
                style={{ backgroundColor: theme.surfaceContainerLowest || '#ffffff' }}
              >
                <BookOpen size={40} style={{ color: theme.onSurfaceVariant || '#454652' }} className="mx-auto mb-2" />
                <p className="text-sm" style={{ color: theme.onSurfaceVariant || '#454652' }}>暂无题目</p>
              </div>
            ) : (
              <div className="space-y-3">
                {subjectsWithQuestions.map((subject) => {
                  const questionCount = learningState.questions.filter(q => q.subjectId === subject.id).length;
                  return (
                    <button
                      key={subject.id}
                      onClick={() => navigate('quiz-session', { subjectId: subject.id })}
                      className="w-full rounded-2xl p-4 flex items-center justify-between active:scale-[0.98] transition-transform"
                      style={{
                        backgroundColor: theme.surfaceContainerLowest || '#ffffff',
                        boxShadow: 'none',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                          style={{ backgroundColor: subject.color + '20' }}
                        >
                          {subject.icon}
                        </div>
                        <div className="text-left min-w-0">
                          <div className="text-sm font-semibold truncate" style={{ color: theme.onSurface || '#191c1d' }}>
                            {subject.name}
                          </div>
                          <div className="text-xs" style={{ color: theme.onSurfaceVariant || '#454652' }}>
                            {questionCount} 道题
                          </div>
                        </div>
                      </div>
                      <div
                        className="p-2 rounded-full"
                        style={{ backgroundColor: theme.primaryFixed || '#dee0ff' }}
                      >
                        <Play size={16} style={{ color: theme.primary || '#24389c' }} fill="currentColor" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Results */}
          {learningState.quizResults.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: theme.onSurface || '#191c1d' }}>
                最近测试
              </h3>
              <div className="space-y-2">
                {learningState.quizResults.slice(-3).reverse().map((result) => {
                  const subject = learningState.subjects.find(s => s.id === result.subjectId);
                  const percentage = Math.round((result.correctCount / result.totalQuestions) * 100);
                  return (
                    <div
                      key={result.id}
                      className="p-3 rounded-xl flex items-center justify-between"
                      style={{ backgroundColor: theme.surfaceContainerLowest || '#ffffff' }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{subject?.icon}</span>
                        <span className="text-sm" style={{ color: theme.onSurface || '#191c1d' }}>
                          {subject?.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs" style={{ color: theme.onSurfaceVariant || '#454652' }}>
                          {result.correctCount}/{result.totalQuestions}
                        </span>
                        <span
                          className="text-sm font-bold px-2 py-1 rounded-lg"
                          style={{
                            backgroundColor: percentage >= 80 ? theme.accent + '20' : percentage >= 60 ? theme.warning + '20' : theme.error + '20',
                            color: percentage >= 80 ? theme.accent : percentage >= 60 ? theme.warning : theme.error,
                          }}
                        >
                          {result.score}分
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <FloatingAIPanel ownerPage="quiz" />
      </div>
    );
  }

  // ===== Playful 风格渲染 =====
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
          background: `linear-gradient(135deg, ${theme.primary}08 0%, ${theme.primaryLight}08 100%)`,
          borderColor: `${theme.primary}30`
        }}>
          <div className="flex items-center gap-2 mb-3">
            <Compass size={16} style={{ color: theme.primary }} />
            <h3 className="text-sm font-semibold" style={{ color: theme.primary }}>今日学习倾向</h3>
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
                  backgroundColor: selectedIntention === key ? theme.primary : theme.bgCard,
                  borderColor: selectedIntention === key ? theme.primary : `${theme.primary}30`,
                  color: selectedIntention === key ? '#ffffff' : theme.textPrimary
                }}
              >
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs" style={{ color: selectedIntention === key ? 'rgba(255,255,255,0.8)' : theme.textSecondary }}>
                  {desc}
                </div>
              </button>
            ))}
          </div>
          {selectedIntention !== 'mixed' && (
            <div className="mt-2 text-xs flex items-center gap-1" style={{ color: theme.primary }}>
              <Sparkles size={12} />
              AI会根据你的学习倾向智能调整出题优先级
            </div>
          )}
        </div>

        <h3 className="text-base font-semibold mb-4" style={{ color: theme.textPrimary }}>选择学科开始测试</h3>

        {subjectsWithQuestions.length === 0 ? (
          <div className={getAnimationClass(3)}>
            <EmptyState
              icon={<BookOpen size={48} style={{ color: theme.textSecondary }} className="mx-auto" />}
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
                      <div className="text-left min-w-0">
                        <div className="font-semibold text-base truncate" style={{ color: theme.textPrimary }}>{subject.name}</div>
                        <div className="text-sm mt-1" style={{ color: theme.textSecondary }}>
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
                      <div className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
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
