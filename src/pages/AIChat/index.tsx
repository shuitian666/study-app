/**
 * ============================================================================
 * AI 问答聊天页面
 * ============================================================================
 *
 * 功能：
 * - 流畅输出（打字效果）
 * - 自动检测AI后端，无缝降级到Mock
 * - 模式切换（本地Ollama / 云端智能模式）
 * - 巩固出题 + 加入知识库
 * ============================================================================
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, Sparkles, Settings2 } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/ui/Common';
import { askQuestionStreaming, generateQuiz } from '@/services/aiService';
import { checkBackendAvailable, getAIConfig } from '@/services/aiClient';
import { calculateNewProficiency } from '@/utils/review';
import type { ChatMessage, Question } from '@/types';
import ChatBubble from './ChatBubble';
import TypingIndicator from './TypingIndicator';
import AISettingsModal from '@/components/ui/AISettingsModal';

const PROVIDER_NAMES: Record<string, string> = {
  ollama: '本地 Ollama',
  volcengine: '火山引擎',
  minimax: 'Minimax',
  douban: '豆包 AI',
};

export default function AIChatPage() {
  const { state, dispatch, navigate } = useApp();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<Record<string, Question>>({});
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [backendMode, setBackendMode] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    const config = getAIConfig();
    // 豆包直连模式不需要检测本地后端，直接显示在线
    if (config.provider === 'douban') {
      if (config.apiKey && config.apiKey.trim().length > 0) {
        setBackendMode('online');
      } else {
        setBackendMode('offline');
      }
      return;
    }
    // 其他模式检测本地后端
    checkBackendAvailable().then(ok => setBackendMode(ok ? 'online' : 'offline'));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.aiChat.messages, state.aiChat.isLoading, streamingMsgId]);

  const handleSend = useCallback(async () => {
    const query = input.trim();
    if (!query || state.aiChat.isLoading) return;

    setInput('');

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: 'AI_SEND_MESSAGE', payload: userMsg });

    const aiMsgId = `msg-${Date.now()}-ai`;
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'ai',
      content: '',
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: 'AI_RECEIVE_MESSAGE', payload: aiMsg });
    setStreamingMsgId(aiMsgId);

    try {
      const { stream, relatedKpIds } = await askQuestionStreaming(
        query,
        state.knowledgePoints,
        state.aiChat.messages,
      );

      let fullContent = '';
      for await (const chunk of stream) {
        fullContent += chunk;
        dispatch({ type: 'AI_UPDATE_STREAMING_MESSAGE', payload: { id: aiMsgId, content: fullContent } });
      }

      setStreamingMsgId(null);
      dispatch({ type: 'AI_SET_LOADING', payload: false });

      // 豆包模式不需要检测本地后端
      const config = getAIConfig();
      if (config.provider === 'douban') {
        setBackendMode('online');
      } else {
        checkBackendAvailable().then(ok => setBackendMode(ok ? 'online' : 'offline'));
      }

      if (relatedKpIds.length > 0) {
        const question = await generateQuiz(
          relatedKpIds,
          state.knowledgePoints,
          state.questions
        );
        if (question) {
          dispatch({ type: 'AI_ADD_GENERATED_QUESTION', payload: question });
          setGeneratedQuestions(prev => ({ ...prev, [aiMsgId]: question }));
        }
      }
    } catch {
      setStreamingMsgId(null);
      dispatch({
        type: 'AI_UPDATE_STREAMING_MESSAGE',
        payload: { id: aiMsgId, content: '抱歉，AI暂时无法回答，请稍后再试。' },
      });
      dispatch({ type: 'AI_SET_LOADING', payload: false });
    }
  }, [input, state.aiChat.isLoading, state.aiChat.messages, state.knowledgePoints, state.questions, dispatch]);

  const handleRequestQuiz = async (aiMessageId: string, content: string) => {
    if (generatedQuestions[aiMessageId]) return;

    const relatedKps = state.knowledgePoints.filter(kp =>
      content.includes(kp.name) || kp.name.split('').some(ch => content.includes(ch) && ch.length > 1)
    );
    const kpIds = relatedKps.length > 0
      ? relatedKps.map(kp => kp.id)
      : state.knowledgePoints.slice(0, 3).map(kp => kp.id);

    const question = await generateQuiz(kpIds, state.knowledgePoints, state.questions);
    if (question) {
      dispatch({ type: 'AI_ADD_GENERATED_QUESTION', payload: question });
      setGeneratedQuestions(prev => ({ ...prev, [aiMessageId]: question }));
    }
  };

  const handleQuizAnswer = (question: Question, isCorrect: boolean, selectedAnswers: string[]) => {
    const kp = state.knowledgePoints.find(k => k.id === question.knowledgePointId);
    if (kp) {
      const newProf = calculateNewProficiency(kp.proficiency, isCorrect);
      dispatch({ type: 'UPDATE_PROFICIENCY', payload: { id: kp.id, proficiency: newProf } });
    }
    if (!isCorrect) {
      dispatch({
        type: 'ADD_WRONG_RECORD',
        payload: {
          id: `wr-${Date.now()}`,
          questionId: question.id,
          wrongAnswers: selectedAnswers,
          correctAnswers: question.correctAnswers,
          addedAt: new Date().toISOString(),
          reviewedCount: 0,
          lastReviewedAt: null,
        },
      });
    }
  };

  const handleAddToKnowledge = (content: string) => {
    const firstLine = content.split('\n')[0].replace(/[#*]/g, '').trim();
    const name = firstLine.length > 20 ?firstLine.slice(0, 20) + '...' : firstLine;

    dispatch({
      type: 'ADD_KNOWLEDGE_POINT',
      payload: {
        id: `kp-ai-${Date.now()}`,
        subjectId: state.subjects[0]?.id ?? 'general',
        chapterId: state.chapters[0]?.id ?? 'general',
        name,
        explanation: content.slice(0, 500),
        proficiency: 'none',
        lastReviewedAt: null,
        nextReviewAt: new Date().toISOString(),
        reviewCount: 0,
        createdAt: new Date().toISOString(),
        source: 'ai',
      },
    });

    const confirmMsg = '已将"' + name + '"加入知识库，你可以在知识库中查看和复习。';
    dispatch({
      type: 'AI_RECEIVE_MESSAGE',
      payload: {
        id: `msg-${Date.now()}-kb`,
        role: 'ai',
        content: confirmMsg,
        timestamp: new Date().toISOString(),
      },
    });
  };

  const handleClear = () => {
    dispatch({ type: 'AI_CLEAR_CHAT' });
    setGeneratedQuestions({});
    setStreamingMsgId(null);
  };

  const config = getAIConfig();
  const modeLabel = backendMode === 'online'
    ? PROVIDER_NAMES[config.provider] || config.provider
    : '离线模式';

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="AI 问答"
        onBack={() => navigate('home')}
        rightAction={
          <div className="flex items-center gap-2">
            {state.aiChat.messages.length > 0 && (
              <button onClick={handleClear} className="text-text-muted active:opacity-60">
                <Trash2 size={18} />
              </button>
            )}
            <button onClick={() => setShowSettings(true)} className="text-text-muted active:opacity-60">
              <Settings2 size={18} />
            </button>
          </div>
        }
      />

      <div className="px-4 py-1.5 text-center">
        <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full ${
          backendMode === 'online'
            ? 'bg-green-50 text-green-600'
            : backendMode === 'offline'
            ? 'bg-amber-50 text-amber-600'
            : 'bg-gray-50 text-gray-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            backendMode === 'online' ? 'bg-green-500' :
            backendMode === 'offline' ? 'bg-amber-500' : 'bg-gray-300'
          }`} />
          {backendMode === 'checking' ? '检测中...' : modeLabel}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {state.aiChat.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mb-4">
              <Sparkles size={28} className="text-violet-500" />
            </div>

            <h3 className="text-base font-semibold text-text-primary mb-1">AI 学习助手</h3>
            <p className="text-sm text-text-muted leading-relaxed">
              有什么不懂的知识点？问我吧！
              <br />
              我会帮你解答并出题测试。
            </p>

            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {['核酸的功能是什么？', '什么是细胞的结构？', '圆周的结构特点'].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="text-xs bg-violet-50 text-violet-600 px-3 py-1.5 rounded-full border border-violet-100 active:opacity-70"
                >
                  {q}
                </button>
              ))}
            </div>

          </div>
        ) : (
          <div className="pt-3">
            {state.aiChat.messages.map(msg => (
              <ChatBubble
                key={msg.id}
                message={msg}
                generatedQuestion={generatedQuestions[msg.id]}
                isStreaming={msg.id === streamingMsgId}
                onRequestQuiz={() => handleRequestQuiz(msg.id, msg.content)}
                onAddToKnowledge={() => handleAddToKnowledge(msg.content)}
                onQuizAnswer={(isCorrect, selectedAnswers) => {
                  const q = generatedQuestions[msg.id];
                  if (q) handleQuizAnswer(q, isCorrect, selectedAnswers);
                }}
              />
            ))}
            {state.aiChat.isLoading && !streamingMsgId && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="shrink-0 bg-white border-t border-border px-4 py-3 safe-bottom">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="输入你的问题..."
            className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            disabled={state.aiChat.isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || state.aiChat.isLoading}
            className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center active:opacity-80 transition-opacity disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      <AISettingsModal show={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
