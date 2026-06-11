import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lightbulb, Loader2, Send, Trash2, X } from 'lucide-react';
import { streamAIStudyTutor } from '@/services/aiStudyService';
import { useStudyTutor } from '@/store/StudyTutorContext';
import type { AIStudyTutorContext, AIStudyTutorMessage } from '@/types';
import StudyRichText from './StudyRichText';

interface StudyTutorPanelProps {
  context: AIStudyTutorContext;
  onClose: () => void;
}

const QUICK_PROMPTS = {
  explain: ['换个说法', '再举个例子', '这里没看懂'],
  question_hint: ['给我一个解题方向', '这题考什么概念？', '帮我排查思路，但别说答案'],
  question_review: ['为什么这个选项正确？', '我选的为什么错？', '换个例子解释'],
} as const;

function makeMessage(role: AIStudyTutorMessage['role'], content = ''): AIStudyTutorMessage {
  return {
    id: `study-tutor-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export default function StudyTutorPanel({ context, onClose }: StudyTutorPanelProps) {
  const { state, dispatch } = useStudyTutor();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const handledRequestRef = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const thread = state.threads[context.threadId] || { messages: [], isLoading: false };
  const quickPrompts = useMemo(() => QUICK_PROMPTS[context.mode], [context.mode]);

  useEffect(() => {
    setInput('');
    setError('');
  }, [context.threadId, context.mode, context.question?.id, context.sectionTitle]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.messages, thread.isLoading]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query || thread.isLoading) return;
    setInput('');
    setError('');
    setLastQuery(query);

    const history = thread.messages.filter(message => message.content.trim());
    const userMessage = makeMessage('user', query);
    const assistantMessage = makeMessage('assistant');
    dispatch({ type: 'ADD_MESSAGE', payload: { threadId: context.threadId, message: userMessage } });
    dispatch({ type: 'ADD_MESSAGE', payload: { threadId: context.threadId, message: assistantMessage } });
    dispatch({ type: 'SET_LOADING', payload: { threadId: context.threadId, isLoading: true } });

    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 90000);
    abortRef.current?.abort();
    abortRef.current = controller;
    let content = '';
    try {
      for await (const chunk of streamAIStudyTutor({
        query,
        context,
        history,
        signal: controller.signal,
      })) {
        content += chunk;
        dispatch({
          type: 'UPDATE_MESSAGE',
          payload: { threadId: context.threadId, messageId: assistantMessage.id, content },
        });
      }
      if (!content.trim()) throw new Error('学习导师没有返回内容，请重试');
    } catch (requestError) {
      if (controller.signal.aborted && !timedOut) return;
      const message = timedOut
        ? '学习导师响应超时，请重试'
        : requestError instanceof Error
          ? requestError.message
          : '学习导师暂时不可用';
      setError(message);
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: { threadId: context.threadId, messageId: assistantMessage.id, content: message },
      });
    } finally {
      window.clearTimeout(timeoutId);
      if (abortRef.current === controller) abortRef.current = null;
      dispatch({ type: 'SET_LOADING', payload: { threadId: context.threadId, isLoading: false } });
    }
  }, [context, dispatch, thread.isLoading, thread.messages]);

  useEffect(() => {
    if (!context.requestId || !context.initialPrompt) return;
    if (thread.isLoading) return;
    if (handledRequestRef.current === context.requestId) return;
    handledRequestRef.current = context.requestId;
    void send(context.initialPrompt);
  }, [context.initialPrompt, context.requestId, send, thread.isLoading]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <div className="text-base font-extrabold text-slate-900">学习导师</div>
          <div className="mt-0.5 truncate text-sm text-slate-500">{context.knowledgePointName}</div>
        </div>
        <div className="flex items-center gap-1">
          {thread.messages.length > 0 && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'CLEAR_THREAD', payload: context.threadId })}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              aria-label="清空当前知识点导师记录"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
            aria-label="关闭学习导师"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {thread.messages.length === 0 && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-base font-bold text-emerald-800">
              <Lightbulb size={19} />
              {context.mode === 'question_hint'
                ? '我只提示思路，不会提前透露答案'
                : context.mode === 'question_review'
                  ? '可以围绕答案和解析继续追问'
                  : '针对当前讲解随时追问'}
            </div>
            <p className="mt-2 text-sm leading-6 text-emerald-700">
              当前上下文：{context.sectionTitle || context.question?.stem || context.knowledgePointName}
            </p>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {thread.messages.map(message => (
            <div
              key={message.id}
              className={`max-w-[92%] rounded-2xl px-4 py-3 text-base leading-7 ${
                message.role === 'user'
                  ? 'ml-auto bg-indigo-600 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              {message.content ? (
                <span className="whitespace-pre-wrap">
                  <StudyRichText text={message.content} />
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <Loader2 size={16} className="animate-spin" /> 正在思考
                </span>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-white p-3">
        <div className="mb-3 flex flex-wrap gap-2">
          {quickPrompts.map(prompt => (
            <button
              key={prompt}
              type="button"
              onClick={() => void send(prompt)}
              disabled={thread.isLoading}
              className="min-h-10 rounded-full border border-indigo-100 bg-indigo-50 px-3 text-sm font-semibold text-indigo-700 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
          {error && lastQuery && (
            <button
              type="button"
              onClick={() => void send(lastQuery)}
              className="min-h-10 rounded-full border border-red-200 bg-red-50 px-3 text-sm font-bold text-red-600"
            >
              重试上次问题
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
            disabled={thread.isLoading}
            placeholder={context.mode === 'question_hint' ? '描述你卡住的地方…' : '继续追问…'}
            className="min-h-11 min-w-0 flex-1 rounded-xl bg-slate-100 px-4 text-base text-slate-900 outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button
            type="button"
            onClick={() => void send(input)}
            disabled={!input.trim() || thread.isLoading}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white disabled:opacity-40"
            aria-label="发送导师问题"
          >
            <Send size={19} />
          </button>
        </div>
      </footer>
    </div>
  );
}
