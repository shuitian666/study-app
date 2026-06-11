import { useState } from 'react';
import { BookPlus, Bot, Lightbulb } from 'lucide-react';
import type { ChatMessage, GenerateSmartQuizResult, TruthPhase } from '@/types';
import InlineQuizCard from './InlineQuizCard';
import TruthResultCard from './TruthResultCard';

interface ChatBubbleProps {
  message: ChatMessage;
  generatedQuestion?: GenerateSmartQuizResult;
  isStreaming?: boolean;
  onRequestQuiz: () => void;
  onAddToKnowledge: () => void;
  onQuizAnswer: (isCorrect: boolean, selectedAnswers: string[]) => void;
  onTruthClarify: (phase: TruthPhase) => void;
}

export default function ChatBubble({
  message,
  generatedQuestion,
  isStreaming = false,
  onRequestQuiz,
  onAddToKnowledge,
  onQuizAnswer,
  onTruthClarify,
}: ChatBubbleProps) {
  const [showQuiz, setShowQuiz] = useState(false);
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-1.5">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-white shadow-sm">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 px-4 py-1.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white">
        <Bot size={16} />
      </div>
      <div className="max-w-[85%]">
        <div className="rounded-2xl rounded-tl-sm border border-border bg-white px-4 py-3 shadow-sm">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
            {message.content}
            {isStreaming && <span className="streaming-cursor">▌</span>}
          </p>
          {message.truthResult && (
            <TruthResultCard result={message.truthResult} onClarify={onTruthClarify} />
          )}
        </div>

        {!isStreaming && message.content && !message.truthResult && (
          <div className="ml-1 mt-1.5 flex items-center gap-2">
            {!showQuiz && !message.relatedQuestionId && (
              <button
                type="button"
                onClick={() => {
                  setShowQuiz(true);
                  onRequestQuiz();
                }}
                className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] text-indigo-600 transition-opacity active:opacity-70"
              >
                <Lightbulb size={12} />
                巩固一下
              </button>
            )}
            <button
              type="button"
              onClick={onAddToKnowledge}
              className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-600 transition-opacity active:opacity-70"
            >
              <BookPlus size={12} />
              加入知识库
            </button>
          </div>
        )}

        {showQuiz && generatedQuestion?.question && (
          <InlineQuizCard question={generatedQuestion.question} onAnswer={onQuizAnswer} />
        )}
      </div>
    </div>
  );
}
