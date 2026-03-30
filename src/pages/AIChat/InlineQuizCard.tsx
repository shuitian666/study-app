/**
 * 内嵌答题卡片 - 嵌入聊天消息流中的紧凑答题体验
 * 复用 QuizSession 的选项逻辑，但不做页面导航
 * 答完后通过 onAnswer(isCorrect, selectedAnswers) 回调父组件处理掌握度更新
 */
import { useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import type { Question } from '@/types';

interface InlineQuizCardProps {
  question: Question;
  onAnswer: (isCorrect: boolean, selectedAnswers: string[]) => void;
}

export default function InlineQuizCard({ question, onAnswer }: InlineQuizCardProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const isCorrect = submitted &&
    selectedAnswers.length === question.correctAnswers.length &&
    selectedAnswers.every(a => question.correctAnswers.includes(a));

  const handleSelect = (optionId: string) => {
    if (submitted) return;
    if (question.type === 'single_choice' || question.type === 'true_false') {
      setSelectedAnswers([optionId]);
    } else {
      setSelectedAnswers(prev =>
        prev.includes(optionId) ? prev.filter(id => id !== optionId) : [...prev, optionId]
      );
    }
  };

  const handleSubmit = () => {
    if (selectedAnswers.length === 0) return;
    setSubmitted(true);
    const correct = selectedAnswers.length === question.correctAnswers.length &&
      selectedAnswers.every(a => question.correctAnswers.includes(a));
    onAnswer(correct, selectedAnswers);
  };

  // 动态生成选项标签，支持 A-Z 最多26个选项
  const labels = question.options.map((_, i) => String.fromCharCode(65 + i));

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100 mt-2">
      <div className="text-[10px] text-indigo-500 font-medium mb-1.5">
        {question.type === 'single_choice' ? '单选题' : question.type === 'true_false' ? '判断题' : '多选题'}
      </div>

      <p className="text-sm font-medium text-gray-800 mb-3 leading-relaxed">{question.stem}</p>


      <div className="space-y-2">
        {question.options.map((opt, i) => {
          const isSelected = selectedAnswers.includes(opt.id);
          const isCorrectOption = question.correctAnswers.includes(opt.id);
          // 强制清除任何前缀，统一显示格式
          const cleanText = opt.text.replace(/^[A-G]\.\s*/, '').trim();

          let style = 'bg-white border-gray-200';
          if (submitted) {
            if (isCorrectOption) style = 'bg-green-50 border-green-300';
            else if (isSelected && !isCorrectOption) style = 'bg-red-50 border-red-300';
          } else if (isSelected) {
            style = 'bg-indigo-50 border-indigo-400';
          }

          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              disabled={submitted}
              className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border-2 transition-all text-left ${style}`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                submitted && isCorrectOption
                  ? 'bg-green-500 text-white'
                  : submitted && isSelected && !isCorrectOption
                    ? 'bg-red-500 text-white'
                    : isSelected
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-200 text-gray-500'
              }`}>
                {submitted && isCorrectOption ? <CheckCircle size={12} /> :
                 submitted && isSelected && !isCorrectOption ? <XCircle size={12} /> :
                 labels[i]}
              </span>
              <span className="text-xs text-gray-700">{labels[i]}. {cleanText}</span>
            </button>
          );
        })}
      </div>


      {!submitted ? (
        <button
          onClick={handleSubmit}
          disabled={selectedAnswers.length === 0}
          className="w-full mt-3 bg-indigo-500 text-white text-xs font-medium py-2 rounded-lg active:opacity-80 transition-opacity disabled:opacity-40"
        >
          确认答案
        </button>

      ) : (
        <div className={`mt-3 p-3 rounded-lg text-xs leading-relaxed ${isCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          <div className="flex items-center gap-1.5 mb-1 font-medium">
            {isCorrect ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {isCorrect ? '回答正确！' : '回答错误'}
          </div>

          {question.explanation}
        </div>

      )}
    </div>

  );
}
