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
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useAIChat } from '@/store/AIChatContext';
import { useTheme } from '@/store/ThemeContext';
import { PageHeader } from '@/components/ui/Common';
import { TopAppBar } from '@/components/layout';
import { askQuestionStreaming, generateQuiz } from '@/services/aiService';
import { checkBackendAvailable, getAIConfig } from '@/services/aiClient';
import { calculateNewProficiency } from '@/utils/review';
import type { ChatMessage, Question, GenerateSmartQuizResult } from '@/types';
import ChatBubble from './ChatBubble';
import TypingIndicator from './TypingIndicator';
import AISettingsModal from '@/components/ui/AISettingsModal';

const PROVIDER_NAMES: Record<string, string> = {
  ollama: '本地 Ollama',
  volcengine: '火山引擎',
  minimax: 'Minimax',
  douban: '豆包 AI',
  openclaw: 'OpenClaw (本地)',
};

export default function AIChatPage() {
  const { userState, navigate } = useUser();
  const { learningState, learningDispatch } = useLearning();
  const { aiChatState, aiChatDispatch } = useAIChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<Record<string, GenerateSmartQuizResult>>({});
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [backendMode, setBackendMode] = useState<'checking' | 'online' | 'offline'>('checking');
  const hasSentInitialQuestion = useRef(false);

  // 解构 aiChat 对象便于使用
  const { messages, isLoading } = aiChatState.aiChat;

  // 检查是否有题目上下文传入，如果有则自动发送
  useEffect(() => {
    const questionContext = userState.pageParams.questionContext;
    if (questionContext && !hasSentInitialQuestion.current && messages.length === 0) {
      hasSentInitialQuestion.current = true;

      // 立即发送题目上下文
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: questionContext,
        timestamp: new Date().toISOString(),
      };
      aiChatDispatch({ type: 'AI_SEND_MESSAGE', payload: userMsg });

      // 清空pageParams避免重复发送
      setTimeout(() => {
        navigate('ai-chat', {});
      }, 100);
    }
  }, [userState.pageParams, messages.length, aiChatDispatch, navigate]);

  useEffect(() => {
    const config = getAIConfig();
    // 豆包模式需要检查 API Key 是否存在
    if (config.provider === 'douban') {
      if (config.apiKey && config.apiKey.trim().length > 0) {
        setBackendMode('online');
      } else {
        setBackendMode('offline');
      }
      return;
    }
    // OpenClaw和其他模式检测本地后端
    checkBackendAvailable().then(ok => setBackendMode(ok ? 'online' : 'offline'));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, streamingMsgId]);

  const handleSend = useCallback(async () => {
    const query = input.trim();
    if (!query || isLoading) return;

    setInput('');

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };
    aiChatDispatch({ type: 'AI_SEND_MESSAGE', payload: userMsg });

    const aiMsgId = `msg-${Date.now()}-ai`;
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'ai',
      content: '',
      timestamp: new Date().toISOString(),
    };
    aiChatDispatch({ type: 'AI_RECEIVE_MESSAGE', payload: aiMsg });
    setStreamingMsgId(aiMsgId);

    try {
      const { stream, relatedKpIds } = await askQuestionStreaming(
        query,
        learningState.knowledgePoints,
        messages,
      );

      let fullContent = '';
      for await (const chunk of stream) {
        fullContent += chunk;
        aiChatDispatch({ type: 'AI_UPDATE_STREAMING_MESSAGE', payload: { id: aiMsgId, content: fullContent } });
      }

      setStreamingMsgId(null);
      aiChatDispatch({ type: 'AI_SET_LOADING', payload: false });

      // 豆包模式不需要检测本地后端
      const config = getAIConfig();
      if (config.provider === 'douban') {
        setBackendMode('online');
      } else {
        checkBackendAvailable().then(ok => setBackendMode(ok ? 'online' : 'offline'));
      }

      if (relatedKpIds.length > 0) {
        const questionResult = await generateQuiz(
          relatedKpIds,
          learningState.knowledgePoints,
          learningState.questions
        );
        if (questionResult.question) {
          aiChatDispatch({ type: 'AI_ADD_GENERATED_QUESTION', payload: questionResult.question });
          setGeneratedQuestions(prev => ({ ...prev, [aiMsgId]: questionResult }));
        }
      }
    } catch (e) {
      setStreamingMsgId(null);
      let errorMsg = '抱歉，AI暂时无法回答，请稍后再试。';
      if (e instanceof Error) {
        errorMsg = `连接豆包API失败：${e.message}`;
        console.error('豆包API错误:', e);
      }
      // API调用失败时设置为离线状态
      setBackendMode('offline');
      aiChatDispatch({
        type: 'AI_UPDATE_STREAMING_MESSAGE',
        payload: { id: aiMsgId, content: errorMsg },
      });
      aiChatDispatch({ type: 'AI_SET_LOADING', payload: false });
    }
  }, [input, isLoading, messages, learningState.knowledgePoints, learningState.questions, aiChatDispatch]);

  const handleRequestQuiz = async (aiMessageId: string, content: string) => {
    if (generatedQuestions[aiMessageId]) return;

    const relatedKps = learningState.knowledgePoints.filter(kp =>
      content.includes(kp.name) || kp.name.split('').some(ch => content.includes(ch) && ch.length > 1)
    );
    const kpIds = relatedKps.length > 0
      ? relatedKps.map(kp => kp.id)
      : learningState.knowledgePoints.slice(0, 3).map(kp => kp.id);

    const questionResult = await generateQuiz(kpIds, learningState.knowledgePoints, learningState.questions);
    if (questionResult.question) {
      aiChatDispatch({ type: 'AI_ADD_GENERATED_QUESTION', payload: questionResult.question });
      setGeneratedQuestions(prev => ({ ...prev, [aiMessageId]: questionResult }));
    }
  };

  const handleQuizAnswer = (question: Question, isCorrect: boolean, selectedAnswers: string[]) => {
    const kp = learningState.knowledgePoints.find(k => k.id === question.knowledgePointId);
    if (kp) {
      const newProf = calculateNewProficiency(kp.proficiency, isCorrect);
      learningDispatch({ type: 'UPDATE_PROFICIENCY', payload: { id: kp.id, proficiency: newProf } });
    }
    if (!isCorrect) {
      learningDispatch({
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

    learningDispatch({
      type: 'ADD_KNOWLEDGE_POINT',
      payload: {
        id: `kp-ai-${Date.now()}`,
        subjectId: learningState.subjects[0]?.id ?? 'general',
        chapterId: learningState.chapters[0]?.id ?? 'general',
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
    aiChatDispatch({
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
    aiChatDispatch({ type: 'AI_CLEAR_CHAT' });
    setGeneratedQuestions({});
    setStreamingMsgId(null);
  };

  const { theme } = useTheme();
  const uiStyle = theme.uiStyle || 'playful';

  const config = getAIConfig();
  const modeLabel = backendMode === 'online'
    ? PROVIDER_NAMES[config.provider] || config.provider
    : '离线模式';

  const actionButtons = (
    <div className="flex items-center gap-1">
      {messages.length > 0 && (
        <button
          onClick={handleClear}
          className="w-9 h-9 flex items-center justify-center rounded-full active:bg-gray-100"
          style={{ color: theme.textMuted || '#757684' }}
        >
          <Trash2 size={18} />
        </button>
      )}
      <button
        onClick={() => setShowSettings(true)}
        className="w-9 h-9 flex items-center justify-center rounded-full active:bg-gray-100"
        style={{ color: theme.textMuted || '#757684' }}
      >
        <Settings2 size={18} />
      </button>
    </div>
  );

  return (
    <div
      className="flex flex-col"
      style={{
        backgroundColor: uiStyle === 'scholar' ? (theme.bg || '#f8f9fa') : 'var(--color-bg)',
        position: 'absolute',
        inset: 0,
      }}
    >
      {uiStyle === 'scholar' ? (
        <TopAppBar
          subtitle="AI TUTOR SESSION"
          showAvatar={false}
          rightContent={actionButtons}
        />
      ) : (
        <PageHeader
          title="AI 问答"
          onBack={() => navigate('home')}
          rightAction={
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
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
      )}

      <div className="px-4 py-1.5 text-center shrink-0">
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
        {messages.length === 0 ? (
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
            {messages.map(msg => (
              <ChatBubble
                key={msg.id}
                message={msg}
                generatedQuestion={generatedQuestions[msg.id]}
                isStreaming={msg.id === streamingMsgId}
                onRequestQuiz={() => handleRequestQuiz(msg.id, msg.content)}
                onAddToKnowledge={() => handleAddToKnowledge(msg.content)}
                onQuizAnswer={(isCorrect, selectedAnswers) => {
                  const result = generatedQuestions[msg.id];
                  if (result?.question) handleQuizAnswer(result.question, isCorrect, selectedAnswers);
                }}
              />
            ))}
            {isLoading && !streamingMsgId && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div
        className="shrink-0 border-t px-4 py-3"
        style={{
          backgroundColor: uiStyle === 'scholar' ? '#ffffff' : 'white',
          borderColor: uiStyle === 'scholar' ? 'rgba(197,197,212,0.3)' : 'var(--color-border)',
          paddingBottom: uiStyle === 'scholar' ? 'calc(84px + env(safe-area-inset-bottom))' : 'calc(12px + env(safe-area-inset-bottom))',
        }}
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="输入你的问题..."
            className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none transition-shadow"
            style={{
              backgroundColor: uiStyle === 'scholar' ? (theme.surfaceContainerHigh || '#e7e8e9') : '#f1f5f9',
              color: theme.onSurface || '#191c1d',
            }}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-xl flex items-center justify-center active:opacity-80 transition-opacity disabled:opacity-40"
            style={{ backgroundColor: theme.primary || '#24389c' }}
          >
            <Send size={18} className="text-white" />
          </button>
        </div>
      </div>

      <AISettingsModal show={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
