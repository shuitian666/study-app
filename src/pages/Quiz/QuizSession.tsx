/**
 * @section QUIZ_SESSION
 * @user:阶段答题 @user:达成目标结算 @user:继续学习
 * 
 * 答题页面功能 (阶段答题模式):
 * 1. 答题过程中只显示正确/错误标记，不显示详细结算
 * 2. AI解析在后台预生成，不阻塞答题流程
 * 3. 完成整个阶段后才显示结算界面
 * 4. 达成学习目标后仍可继续学习
 * 
 * @depends src/hooks/usePreGenerate.ts | src/services/aiService.ts | src/store/LearningContext.tsx | src/store/UserContext.tsx
 */

import { useState, useMemo, useEffect } from 'react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { PageHeader } from '@/components/ui/Common';
import { calculateNewProficiency } from '@/utils/review';
import { CheckCircle, XCircle, ChevronRight, BookOpen, Sparkles, Loader2, MessageSquare } from 'lucide-react';
import type { Question, QuizAnswer } from '@/types';
import { usePreGenerate } from '@/hooks/usePreGenerate';

export default function QuizSessionPage() {

  const { userState, navigate } = useUser();
  const { learningState, learningDispatch } = useLearning();
  const { theme } = useTheme();

  // 动画效果 - 使用次级界面动画设置
  const [animationEffect, setAnimationEffect] = useState<string>('fade-in');
  const subjectId = userState.pageParams.subjectId;
  const knowledgePointId = userState.pageParams.knowledgePointId;

  useEffect(() => {
    const savedEffect = localStorage.getItem('sub-animation-effect');
    if (savedEffect) {
      setAnimationEffect(savedEffect);
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sub-animation-effect' && e.newValue) {
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


  const questions = useMemo(() => {
    let qs = learningState.questions.filter(q => q.subjectId === subjectId);
    if (knowledgePointId) {
      // 先找知识点直接关联的题目
      let directQs = qs.filter(q => q.knowledgePointId === knowledgePointId);
      if (directQs.length > 0) {
        qs = directQs;
      } else {
        // 如果没有直接关联的题目，找同一章节的题目
        const kp = learningState.knowledgePoints.find(k => k.id === knowledgePointId);
        if (kp?.chapterId) {
          qs = qs.filter(q => !q.knowledgePointId && q.chapterId === kp.chapterId);
        }
      }
    }
    // Shuffle
    return [...qs].sort(() => Math.random() - 0.5).slice(0, 10);
  }, [learningState.questions, learningState.knowledgePoints, subjectId, knowledgePointId]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [showKnowledge, setShowKnowledge] = useState(false);
  // 收集本次答题结果用于最终显示
  const [stageResults, setStageResults] = useState<{ questionId: string; isCorrect: boolean; selectedAnswers: string[] }[]>([]);

  const currentQuestion: Question | undefined = questions[currentIndex];
  const relatedKP = learningState.knowledgePoints.find(k => k.id === currentQuestion?.knowledgePointId);
  const [generatingExplanation, setGeneratingExplanation] = useState<string | null>(null);
  const { getSavedExplanation, generateExplanationOnDemand } = usePreGenerate();

  // 关闭预生成，改为点击才生成，节省token
  useEffect(() => {
    // 不再预生成，用户主动点击才生成
  }, [questions]);

  // 当前题目已生成的解释
  const currentExplanation = currentQuestion ? getSavedExplanation(currentQuestion.id) : null;

  // 处理点击生成解释
  const handleGenerateExplanation = async () => {
    if (!currentQuestion) return;
    
    setGeneratingExplanation(currentQuestion.id);
    const relatedKP = learningState.knowledgePoints.find(kp => kp.id === currentQuestion.knowledgePointId);
    const subject = learningState.subjects.find(s => s.id === subjectId);
    
    await generateExplanationOnDemand(
      currentQuestion.id,
      { stem: currentQuestion.stem, options: currentQuestion.options },
      selectedAnswers,
      currentQuestion.correctAnswers,
      relatedKP?.name,
      subject?.name
    );
    
    setGeneratingExplanation(null);
  };
  
  const isCorrect = currentQuestion
    ? selectedAnswers.length === currentQuestion.correctAnswers.length &&
      selectedAnswers.every(a => currentQuestion.correctAnswers.includes(a))
    : false;

  const handleSelectOption = (optionId: string) => {
    if (showResult) return;
    if (currentQuestion?.type === 'single_choice') {
      setSelectedAnswers([optionId]);
    } else {
      setSelectedAnswers(prev =>
        prev.includes(optionId) ? prev.filter(id => id !== optionId) : [...prev, optionId]
      );
    }
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswers.length === 0 || !currentQuestion) return;

    const correct = selectedAnswers.length === currentQuestion.correctAnswers.length &&
      selectedAnswers.every(a => currentQuestion.correctAnswers.includes(a));

    setShowResult(true);
    
    const answer: QuizAnswer = {
      questionId: currentQuestion.id,
      selectedAnswers,
      isCorrect: correct,
    };
    setAnswers(prev => [...prev, answer]);
    
    // 记录本题结果用于最终显示
    setStageResults(prev => [...prev, { questionId: currentQuestion.id, isCorrect: correct, selectedAnswers }]);

    // Update proficiency
    if (relatedKP) {
      const newProf = calculateNewProficiency(relatedKP.proficiency, correct);
      learningDispatch({ type: 'UPDATE_PROFICIENCY', payload: { id: relatedKP.id, proficiency: newProf } });
    }

    // Add wrong record
    if (!correct) {
      learningDispatch({
        type: 'ADD_WRONG_RECORD',
        payload: {
          id: `wr-${Date.now()}`,
          questionId: currentQuestion.id,
          wrongAnswers: selectedAnswers,
          correctAnswers: currentQuestion.correctAnswers,
          addedAt: new Date().toISOString(),
          reviewedCount: 0,
          lastReviewedAt: null,
        },
      });
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswers([]);
      setShowResult(false);
      setShowKnowledge(false);
    } else {
      // Stage finished - navigate to result page
      const allAnswers = [...answers];
      const correctCount = allAnswers.filter(a => a.isCorrect).length;
      const score = Math.round((correctCount / allAnswers.length) * 100);

      learningDispatch({
        type: 'ADD_QUIZ_RESULT',
        payload: {
          id: `qr-${Date.now()}`,
          subjectId: subjectId ?? '',
          totalQuestions: allAnswers.length,
          correctCount,
          score,
          answers: allAnswers,
          completedAt: new Date().toISOString(),
        },
      });
      
      // 传递所有题目结果用于最终解析显示
      const resultId = `qr-${Date.now()}`;
      navigate('quiz-result', { 
        resultId, 
        score: String(score), 
        correct: String(correctCount), 
        total: String(allAnswers.length),
        subjectId: subjectId ?? '',
        stage: userState.pageParams.stage ?? '1',
        stageResults: JSON.stringify(stageResults)
      });
    }
  };

  if (questions.length === 0) {
    return (
      <div>
        <PageHeader title="答题" onBack={() => navigate('quiz')} />
        <div className="p-8 text-center text-text-muted">该学科暂无题目</div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const subject = learningState.subjects.find(s => s.id === subjectId);

  return (
    <div className="page-scroll pb-4">
      <PageHeader
        title={`${subject?.icon ?? ''} 答题 ${currentIndex + 1}/${questions.length}`}
        onBack={() => navigate('quiz')}
      />

      {/* Progress bar */}
      <div className={`px-4 pt-2 ${getAnimationClass(1)}`}>
        <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ backgroundColor: theme.border }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ 
              width: `${((currentIndex + 1) / questions.length) * 100}%`,
              backgroundColor: theme.primary
            }}
          />
        </div>
      </div>


      {/* Review knowledge point before answering */}
      {relatedKP && !showKnowledge && !showResult && (
        <div className={`px-4 pt-3 ${getAnimationClass(2)}`}>
          <button
            onClick={() => setShowKnowledge(!showKnowledge)}
            className="w-full rounded-xl p-3 border flex items-center justify-between"
            style={{ 
              backgroundColor: '#eff6ff',
              borderColor: '#dbeafe'
            }}
          >
            <div className="flex items-center gap-2 text-sm" style={{ color: '#1e40af' }}>
              <BookOpen size={14} />
              <span>先回顾知识点：{relatedKP.name}</span>
            </div>

            <ChevronRight size={14} style={{ color: '#60a5fa' }} />
          </button>

        </div>

      )}


      {showKnowledge && relatedKP && (
        <div className={`px-4 pt-2 ${getAnimationClass(3)}`}>
          <div className="rounded-xl p-4 border" style={{ 
            backgroundColor: '#eff6ff',
            borderColor: '#dbeafe'
          }}>
            <h4 className="text-sm font-medium mb-1" style={{ color: '#1e40af' }}>{relatedKP.name}</h4>
            <p className="text-xs leading-relaxed" style={{ color: '#2563eb' }}>{relatedKP.explanation}</p>
            <button
              onClick={() => setShowKnowledge(false)}
              className="mt-2 text-xs underline"
              style={{ color: '#3b82f6' }}
            >
              收起
            </button>

          </div>

        </div>

      )}

      {/* Question */}
      <div className={`px-4 pt-4 ${getAnimationClass(4)}`}>
        <div className="rounded-2xl p-5 border shadow-sm" style={{ backgroundColor: theme.bgCard, borderColor: theme.border }}>
          <div className="text-xs mb-2" style={{ color: theme.textMuted }}>
            {currentQuestion.type === 'single_choice' ? '单选题' : '多选题'}
          </div>

          <p className="text-base font-medium leading-relaxed mb-4" style={{ color: theme.textPrimary }}>{currentQuestion.stem}</p>

          {/* Options - 动态标签支持更多选项 */}
          <div className="space-y-2.5">
            {currentQuestion.options.map((opt, i) => {
              const isSelected = selectedAnswers.includes(opt.id);
              const isCorrectOption = currentQuestion.correctAnswers.includes(opt.id);
              const labels = currentQuestion.options.map((_, idx) => String.fromCharCode(65 + idx));
              // 强制清除任何前缀，统一显示格式
              const cleanText = opt.text.replace(/^[A-G]\.\s*/, '').trim();

              let optionStyle = {};
              if (showResult) {
                if (isCorrectOption) {
                  optionStyle = { backgroundColor: '#f0fdf4', borderColor: '#dcfce7' };
                } else if (isSelected && !isCorrectOption) {
                  optionStyle = { backgroundColor: '#fef2f2', borderColor: '#fee2e2' };
                } else {
                  optionStyle = { backgroundColor: theme.bgCard, borderColor: theme.border };
                }
              } else if (isSelected) {
                optionStyle = { backgroundColor: `${theme.primary}10`, borderColor: theme.primary };
              } else {
                optionStyle = { backgroundColor: theme.bgCard, borderColor: theme.border };
              }

              return (
                <div key={opt.id} className={getAnimationClass(5 + i)}>
                  <button
                    onClick={() => handleSelectOption(opt.id)}
                    disabled={showResult}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left"
                    style={optionStyle}
                  >
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0`} style={{
                      backgroundColor: showResult && isCorrectOption
                        ? '#22c55e' : showResult && isSelected && !isCorrectOption
                          ? '#f87171' : isSelected
                            ? theme.primary : theme.border,
                      color: showResult || isSelected ? '#ffffff' : theme.textSecondary
                    }}>
                      {showResult && isCorrectOption ? <CheckCircle size={16} /> :
                       showResult && isSelected && !isCorrectOption ? <XCircle size={16} /> :
                       labels[i]}
                    </span>

                    <div className="flex-1">
                      <span className="text-xs font-medium mr-2" style={{ color: theme.textMuted }}>{labels[i]}.</span>
                      <span className="text-sm font-semibold" style={{ 
                        color: showResult && isCorrectOption 
                          ? '#16a34a' 
                          : showResult && isSelected && !isCorrectOption 
                            ? '#dc2626' 
                            : theme.textPrimary 
                      }}>{cleanText}</span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>


      {/* Stage result - simplified, no detailed settlement per question */}
      {showResult && currentQuestion && (
        <div className={`px-4 pt-3 ${getAnimationClass(6)}`}>
          {/* 简洁的结果提示 */}
          <div className="rounded-2xl p-4 border" style={{ 
            backgroundColor: isCorrect ? '#f0fdf4' : '#fef2f2',
            borderColor: isCorrect ? '#dcfce7' : '#fee2e2'
          }}>
            <div className="flex items-center gap-3">
              {isCorrect ? (
                <CheckCircle size={24} style={{ color: '#22c55e' }} />
              ) : (
                <XCircle size={24} style={{ color: '#f87171' }} />
              )}
              <div className="flex-1">
                <span className="font-medium text-sm" style={{ 
                  color: isCorrect ? '#16a34a' : '#dc2626'
                }}>
                  {isCorrect ? '回答正确！' : '回答错误'}
                </span>
                {!isCorrect && (
                  <p className="text-xs mt-1" style={{ color: theme.textMuted }}>
                    正确答案: {currentQuestion.correctAnswers.map(a => {
                      const idx = currentQuestion.options.findIndex(o => o.id === a);
                      return String.fromCharCode(65 + idx);
                    }).join('、')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* AI解析：用户点击才生成，放在这里正好，答完题就可以看 */}
          <div className="mt-3">
            {currentExplanation ? (
              <div className="text-sm rounded-xl p-3" style={{ 
                color: '#7e22ce',
                backgroundColor: '#f3e8ff'
              }}>
                <div className="font-medium mb-1">AI解析：</div>
                {currentExplanation}
              </div>
            ) : (
              <button
                onClick={handleGenerateExplanation}
                disabled={generatingExplanation === currentQuestion.id}
                className="w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ 
                  backgroundColor: '#f3e8ff',
                  color: '#7e22ce'
                }}
              >
                {generatingExplanation === currentQuestion.id ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    AI正在生成解析...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    查看AI解析（点击生成）
                  </>
                )}
              </button>
            )}
          </div>

          {/* 如果有解析且用户仍有疑问，可以追问 */}
          {currentExplanation && (
            <div className="mt-2 flex justify-end">
              <button
                onClick={() => {
                  // 构建完整的题目上下文
                  const optionsText = currentQuestion.options.map((opt, idx) => {
                    const label = String.fromCharCode(65 + idx);
                    return `${label}. ${opt.text.replace(/^[A-G]\.\s*/, '').trim()}`;
                  }).join('\n');

                  const correctLabels = currentQuestion.correctAnswers.map(a => {
                    const idx = currentQuestion.options.findIndex(o => o.id === a);
                    return String.fromCharCode(65 + idx);
                  }).join('、');

                  const fullContext = `题目：${currentQuestion.stem}

选项：
${optionsText}

正确答案：${correctLabels}

AI解析：${currentExplanation}

我对这道题的解析还有疑问，请进一步详细讲解。`;

                  navigate('ai-chat', {
                    questionContext: fullContext,
                    subjectId: subjectId,
                    ...(currentQuestion.knowledgePointId && { knowledgePointId: currentQuestion.knowledgePointId })
                  });
                }}
                className="text-xs flex items-center gap-1 px-2 py-1 rounded-md hover:opacity-80"
                style={{ color: '#2563eb' }}
              >
                <MessageSquare size={10} />
                仍不理解，继续追问AI
              </button>
            </div>
          )}
        </div>

      )}


      {/* Action buttons */}
      <div className={`px-4 pt-4 pb-8 ${getAnimationClass(7)}`}>
        {!showResult ? (
          <button
            onClick={handleSubmitAnswer}
            disabled={selectedAnswers.length === 0}
            className="w-full font-medium py-3 rounded-xl text-sm shadow-md active:opacity-80 transition-opacity disabled:opacity-50"
            style={{ 
              backgroundColor: theme.primary,
              color: '#ffffff'
            }}
          >
            确认答案
          </button>

        ) : (
          <button
            onClick={handleNext}
            className="w-full font-medium py-3 rounded-xl text-sm shadow-md active:opacity-80 transition-opacity"
            style={{ 
              backgroundColor: theme.primary,
              color: '#ffffff'
            }}
          >
            {currentIndex < questions.length - 1 ? '下一题' : '查看结果'}
          </button>

        )}
      </div>
    </div>
  );
}
