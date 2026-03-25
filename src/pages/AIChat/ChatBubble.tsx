/**
 * 聊天消息气泡组件
 * - user 消息：右对齐蓝色气泡
 * - ai 消息：左对齐白色卡片 + AI 头像 + 操作按钮（巩固一下 / 加入知识库）
 * - 支持 isStreaming 状态：流式时显示闪烁光标，隐藏操作按钮
 */
import { useState } from 'react';
import { Bot, Lightbulb, BookPlus } from 'lucide-react';
import type { ChatMessage, Question } from '@/types';
import InlineQuizCard from './InlineQuizCard';

interface ChatBubbleProps {
  message: ChatMessage;
  generatedQuestion?: Question;
  isStreaming?: boolean;
  onRequestQuiz: () => void;
  onAddToKnowledge: () => void;
  onQuizAnswer: (isCorrect: boolean, selectedAnswers: string[]) => void;
}

export default function ChatBubble({
  message,
  generatedQuestion,
  isStreaming = false,
  onRequestQuiz,
  onAddToKnowledge,
  onQuizAnswer,
}: ChatBubbleProps) {
  const [showQuiz, setShowQuiz] = useState(false);
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-1.5">
        <div className="max-w-[80%] bg-primary text-white rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 px-4 py-1.5">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shrink-0">
        <Bot size={16} />
      </div>
      <div className="max-w-[85%]">
        <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-border">
          <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
            {message.content}
            {isStreaming && <span className="streaming-cursor">▍</span>}
          </p>
        </div>

        {/* Action buttons — only show when not streaming and has content */}
        {!isStreaming && message.content && (
          <div className="flex items-center gap-2 mt-1.5 ml-1">
            {!showQuiz && !message.relatedQuestionId && (
              <button
                onClick={() => {
                  setShowQuiz(true);
                  onRequestQuiz();
                }}
                className="flex items-center gap-1 text-[11px] text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full active:opacity-70 transition-opacity"
              >
                <Lightbulb size={12} />
                巩固一下
              </button>
            )}
            <button
              onClick={onAddToKnowledge}
              className="flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full active:opacity-70 transition-opacity"
            >
              <BookPlus size={12} />
              加入知识库
            </button>
          </div>
        )}

        {/* Inline quiz card */}
        {showQuiz && generatedQuestion && (
          <InlineQuizCard question={generatedQuestion} onAnswer={onQuizAnswer} />
        )}
      </div>
    </div>
  );
}
