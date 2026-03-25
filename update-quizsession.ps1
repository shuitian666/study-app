$content = Get-Content "C:\Users\35460\study-app\src\pages\Quiz\QuizSession.tsx" -Raw -Encoding UTF8

# 更新导入
$oldImport = "import { useState, useMemo } from 'react';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/ui/Common';
import { calculateNewProficiency } from '@/utils/review';
import { CheckCircle, XCircle, ChevronRight, BookOpen, Sparkles, Loader2 } from 'lucide-react';
import type { Question, QuizAnswer } from '@/types';
import { generateQuestionExplanation } from '@/services/aiService';"

$newImport = "import { useState, useMemo } from 'react';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/ui/Common';
import { calculateNewProficiency } from '@/utils/review';
import { CheckCircle, XCircle, ChevronRight, BookOpen, Sparkles, Loader2, MessageSquare, Edit3, Save, X } from 'lucide-react';
import type { Question, QuizAnswer } from '@/types';
import { generateQuestionExplanation } from '@/services/aiService';"

$content = $content.Replace($oldImport, $newImport)

# 添加质疑状态
$oldState = "const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);"

$newState = @"const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [isChallenging, setIsChallenging] = useState(false);
  const [editedExplanation, setEditedExplanation] = useState('');"

$content = $content.Replace($oldState, $newState)

# 添加获取保存解析的逻辑
$oldUseMemo = "const questions = useMemo(() => {"
$newUseMemo = @"// Get saved explanation for a question
  const getSavedExplanation = (qId: string): string | null => {
    const saved = state.questionExplanations.find(e => e.questionId === qId);
    return saved ? saved.explanation : null;
  };

  const questions = useMemo(() => {"

$content = $content.Replace($oldUseMemo, $newUseMemo)

# 修改handleSubmitAnswer函数中的AI生成逻辑
$oldSubmit = @"// 使用AI生成更详细的解析
    setLoadingAI(true);
    try {
      const explanation = await generateQuestionExplanation({
        question: {
          stem: currentQuestion.stem,
          options: currentQuestion.options,
        },
        selectedAnswer: selectedAnswers,
        correctAnswer: currentQuestion.correctAnswers,
      });
      setAiExplanation(explanation);
    } catch {
      setAiExplanation(null);
    }
    setLoadingAI(false);"

$newSubmit = @"// 使用AI生成更详细的解析（检查是否已有保存的）
    const savedExp = getSavedExplanation(currentQuestion.id);
    if (savedExp) {
      setAiExplanation(savedExp);
    } else {
      setLoadingAI(true);
      try {
        const explanation = await generateQuestionExplanation({
          question: {
            stem: currentQuestion.stem,
            options: currentQuestion.options,
          },
          selectedAnswer: selectedAnswers,
          correctAnswer: currentQuestion.correctAnswers,
        });
        setAiExplanation(explanation);
        // 保存解析供下次使用
        dispatch({
          type: 'SAVE_QUESTION_EXPLANATION',
          payload: {
            questionId: currentQuestion.id,
            explanation: explanation,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isUserModified: false,
          },
        });
      } catch {
        setAiExplanation(null);
      }
      setLoadingAI(false);
    }"

$content = $content.Replace($oldSubmit, $newSubmit)

# 添加质疑功能
$oldResultSection = @"<div className=""rounded-2xl p-4 border border-purple-200 bg-purple-50"">
              <div className=""flex items-center gap-2 mb-2"">
                {loadingAI ? (
                  <>
                    <Loader2 size={16} className=""text-purple-600 animate-spin"" />
                    <span className=""text-sm text-purple-700"">AI正在生成详细解析...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} className=""text-purple-600"" />
                    <span className=""text-sm text-purple-700 font-medium"">AI详细解析</span>
                  </>
                )}
              </div>
              
              {aiExplanation && (
                <p className=""text-xs text-purple-800 leading-relaxed whitespace-pre-wrap"">
                  {aiExplanation}
                </p>
              )}
            </div>"

$newResultSection = @"<div className=""rounded-2xl p-4 border border-purple-200 bg-purple-50"">
              <div className=""flex items-center justify-between mb-2"">
                {loadingAI ? (
                  <div className=""flex items-center gap-2"">
                    <Loader2 size={16} className=""text-purple-600 animate-spin"" />
                    <span className=""text-sm text-purple-700"">AI正在生成详细解析...</span>
                  </div>
                ) : (
                  <div className=""flex items-center gap-2"">
                    <Sparkles size={16} className=""text-purple-600"" />
                    <span className=""text-sm text-purple-700 font-medium"">AI详细解析</span>
                  </div>
                )}
                
                {!loadingAI && aiExplanation && (
                  <button
                    onClick={() => {
                      setEditedExplanation(aiExplanation || '');
                      setIsChallenging(true);
                    }}
                    className=""flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 transition-colors""
                  >
                    <MessageSquare size={12} />
                    质疑
                  </button>
                )}
              </div>
              
              {!isChallenging && aiExplanation && (
                <p className=""text-xs text-purple-800 leading-relaxed whitespace-pre-wrap"">
                  {aiExplanation}
                </p>
              )}
              
              {isChallenging && (
                <div className=""space-y-2"">
                  <textarea
                    value={editedExplanation}
                    onChange={(e) => setEditedExplanation(e.target.value)}
                    className=""w-full p-3 rounded-lg border border-purple-300 text-xs leading-relaxed resize-none outline-none focus:border-purple-500""
                    rows={4}
                    placeholder=""输入你认为正确的解析...""
                  />
                  <div className=""flex gap-2"">
                    <button
                      onClick={() => {
                        dispatch({
                          type: 'UPDATE_QUESTION_EXPLANATION',
                          payload: { questionId: currentQuestion.id, explanation: editedExplanation },
                        });
                        setAiExplanation(editedExplanation);
                        setIsChallenging(false);
                      }}
                      className=""flex-1 flex items-center justify-center gap-1 py-2 bg-purple-500 text-white text-xs rounded-lg hover:bg-purple-600 transition-colors""
                    >
                      <Save size={12} />
                      保存
                    </button>
                    <button
                      onClick={() => setIsChallenging(false)}
                      className=""flex items-center justify-center gap-1 px-4 py-2 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 transition-colors""
                    >
                      <X size={12} />
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>"

$content = $content.Replace($oldResultSection, $newResultSection)

[System.IO.File]::WriteAllText("C:\Users\35460\study-app\src\pages\Quiz\QuizSession.tsx", $content, [System.Text.Encoding]::UTF8)
Write-Output "Updated QuizSession with challenge feature"
