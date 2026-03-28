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
 * @depends src/hooks/usePreGenerate.ts | src/services/aiService.ts | src/store/AppContext.tsx
 */

import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/ui/Common';
import { calculateNewProficiency } from '@/utils/review';
import { CheckCircle, XCircle, ChevronRight, BookOpen, Sparkles, Zap } from 'lucide-react';
import type { Question, QuizAnswer } from '@/types';
import { usePreGenerate } from '@/hooks/usePreGenerate';

export default function QuizSessionPage() {

  const { state, dispatch, navigate } = useApp();
  const subjectId = state.pageParams.subjectId;
  const knowledgePointId = state.pageParams.knowledgePointId;
  const { preGenerateExplanations } = usePreGenerate();
  
  // Pre-generation state
  const [preGenProgress, setPreGenProgress] = useState<{ current: number; total: number } | null>(null);

  const questions = useMemo(() => {
    let qs = state.questions.filter(q => q.subjectId === subjectId);
    if (knowledgePointId) {
      qs = qs.filter(q => q.knowledgePointId === knowledgePointId);
    }
    // Shuffle
    return [...qs].sort(() => Math.random() - 0.5).slice(0, 10);
  }, [state.questions, subjectId, knowledgePointId]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [showKnowledge, setShowKnowledge] = useState(false);
  // 收集本次答题结果用于最终显示
  const [stageResults, setStageResults] = useState<{ questionId: string; isCorrect: boolean; selectedAnswers: string[] }[]>([]);

  const currentQuestion: Question | undefined = questions[currentIndex];
  const relatedKP = state.knowledgePoints.find(k => k.id === currentQuestion?.knowledgePointId);

  // Start pre-generating explanations when questions are loaded
  useEffect(() => {
    if (questions.length > 0 && preGenProgress === null) {
      setPreGenProgress({ current: 0, total: questions.length });
      const timeoutId = setTimeout(() => setPreGenProgress(null), 500);
      preGenerateExplanations(questions, (current, total) => {
        setPreGenProgress({ current, total });
        if (current >= total) {
          clearTimeout(timeoutId);
          setTimeout(() => setPreGenProgress(null), 500);
        }
      });
      return () => clearTimeout(timeoutId);
    }
  }, [questions, preGenerateExplanations]);
  
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
      dispatch({ type: 'UPDATE_PROFICIENCY', payload: { id: relatedKP.id, proficiency: newProf } });
    }

    // Add wrong record
    if (!correct) {
      dispatch({
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

      dispatch({
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
        stage: state.pageParams.stage ?? '1',
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

  const subject = state.subjects.find(s => s.id === subjectId);

  return (
    <div className="page-scroll pb-4">
      <PageHeader
        title={`${subject?.icon ?? ''} 答题 ${currentIndex + 1}/${questions.length}`}
        onBack={() => navigate('quiz')}
      />

      {/* Pre-generation progress indicator */}
      {preGenProgress && preGenProgress.current < preGenProgress.total && (
        <div className="px-4 pt-2">
          <div className="bg-purple-50 rounded-xl p-3 border border-purple-200 flex items-center gap-3">
            <Zap size={16} className="text-purple-600 animate-pulse" />
            <div className="flex-1">
              <div className="text-xs text-purple-700 font-medium">AI正在预生成解析...</div>
              <div className="w-full bg-purple-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${(preGenProgress.current / preGenProgress.total) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-purple-600">{preGenProgress.current}/{preGenProgress.total}</span>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="px-4 pt-2">
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>


      {/* Review knowledge point before answering */}
      {relatedKP && !showKnowledge && !showResult && (
        <div className="px-4 pt-3">
          <button
            onClick={() => setShowKnowledge(!showKnowledge)}
            className="w-full bg-blue-50 rounded-xl p-3 border border-blue-100 flex items-center justify-between"
          >
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <BookOpen size={14} />
              <span>先回顾知识点：{relatedKP.name}</span>
            </div>

            <ChevronRight size={14} className="text-blue-400" />
          </button>

        </div>

      )}


      {showKnowledge && relatedKP && (
        <div className="px-4 pt-2">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <h4 className="text-sm font-medium text-blue-800 mb-1">{relatedKP.name}</h4>
            <p className="text-xs text-blue-600 leading-relaxed">{relatedKP.explanation}</p>
            <button
              onClick={() => setShowKnowledge(false)}
              className="mt-2 text-xs text-blue-500 underline"
            >
              收起
            </button>

          </div>

        </div>

      )}

      {/* Question */}
      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl p-5 border border-border shadow-sm">
          <div className="text-xs text-text-muted mb-2">
            {currentQuestion.type === 'single_choice' ? '单选题' : '多选题'}
          </div>

          <p className="text-base font-medium leading-relaxed mb-4">{currentQuestion.stem}</p>

          {/* Options - 动态标签支持更多选项 */}
          <div className="space-y-2.5">
            {currentQuestion.options.map((opt, i) => {
              const isSelected = selectedAnswers.includes(opt.id);
              const isCorrectOption = currentQuestion.correctAnswers.includes(opt.id);
              const labels = currentQuestion.options.map((_, idx) => String.fromCharCode(65 + idx));

              let optionStyle = 'bg-gray-50 border-gray-200';
              if (showResult) {
                if (isCorrectOption) {
                  optionStyle = 'bg-green-50 border-green-300';
                } else if (isSelected && !isCorrectOption) {
                  optionStyle = 'bg-red-50 border-red-300';
                }
              } else if (isSelected) {
                optionStyle = 'bg-primary/10 border-primary';
              }


              return (
                <button
                  key={opt.id}
                  onClick={() => handleSelectOption(opt.id)}
                  disabled={showResult}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${optionStyle}`}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    showResult && isCorrectOption
                      ? 'bg-green-500 text-white'
                      : showResult && isSelected && !isCorrectOption
                        ? 'bg-red-500 text-white'
                        : isSelected
                          ? 'bg-primary text-white'
                          : 'bg-gray-200 text-text-secondary'
                  }`}>
                    {showResult && isCorrectOption ? <CheckCircle size={16} /> :
                     showResult && isSelected && !isCorrectOption ? <XCircle size={16} /> :
                     labels[i]}
                  </span>

                  <div className="flex-1">
                    <span className="text-xs font-medium text-text-muted mr-2">{labels[i]}.</span>
                    <span className="text-sm">{opt.text}</span>
                  </div>
                </button>

              );
            })}
          </div>
        </div>
      </div>


      {/* Stage result - simplified, no detailed settlement per question */}
      {showResult && (
        <div className="px-4 pt-3">
          {/* 简洁的结果提示 */}
          <div className={`rounded-2xl p-4 border ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-3">
              {isCorrect ? (
                <CheckCircle size={24} className="text-green-600" />
              ) : (
                <XCircle size={24} className="text-red-600" />
              )}
              <div className="flex-1">
                <span className={`font-medium text-sm ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                  {isCorrect ? '回答正确！' : '回答错误'}
                </span>
                {!isCorrect && (
                  <p className="text-xs text-text-secondary mt-1">
                    正确答案: {currentQuestion.correctAnswers.map(a => {
                      const idx = currentQuestion.options.findIndex(o => o.id === a);
                      return String.fromCharCode(65 + idx);
                    }).join('、')}
                  </p>
                )}
              </div>
              {preGenProgress && preGenProgress.current < preGenProgress.total && (
                <div className="flex items-center gap-1 text-xs text-purple-600">
                  <Sparkles size={12} />
                  <span>AI解析中</span>
                </div>
              )}
            </div>
          </div>
        </div>

      )}


      {/* Action buttons */}
      <div className="px-4 pt-4 pb-8">
        {!showResult ? (
          <button
            onClick={handleSubmitAnswer}
            disabled={selectedAnswers.length === 0}
            className="w-full bg-primary text-white font-medium py-3 rounded-xl text-sm shadow-md active:opacity-80 transition-opacity disabled:opacity-50"
          >
            确认答案
          </button>

        ) : (
          <button
            onClick={handleNext}
            className="w-full bg-primary text-white font-medium py-3 rounded-xl text-sm shadow-md active:opacity-80 transition-opacity"
          >
            {currentIndex < questions.length - 1 ? '下一题' : '查看结果'}
          </button>

        )}
      </div>
    </div>
  );
}
