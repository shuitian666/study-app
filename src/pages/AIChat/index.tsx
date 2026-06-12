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

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { BookOpen, Check, ChevronDown, History, Lock, MessageCircle, ScanSearch, Send, Settings2, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useGame } from '@/store/GameContext';
import { useAIChat } from '@/store/AIChatContext';
import { PageHeader } from '@/components/ui/Common';
import { askQuestionStreaming, generateQuiz } from '@/services/aiService';
import { checkBackendAvailable, fetchAIConfig, getAIConfig } from '@/services/aiClient';
import { fetchTruthStatus, searchTruth, type TruthStatus } from '@/services/truthService';
import { calculateNewProficiency } from '@/utils/review';
import { buildAILearningContext } from '@/utils/aiLearningContext';
import { AI_STUDY_UNLOCK_LEVEL, getAIStudyLevelInfo } from '@/utils/aiStudyAccess';
import type { ChatMessage, Question, GenerateSmartQuizResult, TruthPhase, TruthSearchFilter } from '@/types';
import ChatBubble from './ChatBubble';
import TypingIndicator from './TypingIndicator';
import AISettingsModal from '@/components/ui/AISettingsModal';


const CHAT_REQUEST_TIMEOUT_MS = 90000;
const EMPTY_AI_RESPONSE = 'AI 没有返回内容，请重试或检查配置';
const GENERIC_AI_ERROR = 'AI 暂时无法回答，请稍后重试。';
const TIMEOUT_AI_ERROR = 'AI 请求超时，请稍后重试。';

interface AIChatPageProps {
  embedded?: boolean;
  embeddedQuestionContext?: {
    id: string;
    text: string;
  } | null;
  onClose?: () => void;
}

export default function AIChatPage({
  embedded = false,
  embeddedQuestionContext = null,
  onClose,
}: AIChatPageProps) {
  const { userState, navigate } = useUser();
  const { learningState, learningDispatch } = useLearning();
  const { gameState } = useGame();
  const { aiChatState, aiChatDispatch } = useAIChat();
  const [input, setInput] = useState('');
  const [activeMode, setActiveMode] = useState<'chat' | 'study' | 'truth'>('chat');
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [studySubjectId, setStudySubjectId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<Record<string, GenerateSmartQuizResult>>({});
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [backendMode, setBackendMode] = useState<'checking' | 'online' | 'offline'>('checking');
  const [aiMode, setAiMode] = useState<'platform' | 'custom'>('platform');
  const [truthStatus, setTruthStatus] = useState<TruthStatus | null>(null);
  const activeAbortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledQuestionContextRef = useRef<string | null>(null);

  // 解构 aiChat 对象便于使用
  const { messages, isLoading } = aiChatState.aiChat;
  const aiStudyAccess = getAIStudyLevelInfo(userState.user, learningState, gameState.checkin);
  const studySubjects = useMemo(
    () => learningState.subjects.filter(subject => learningState.knowledgePoints.some(kp => kp.subjectId === subject.id && !kp.deletedAt)),
    [learningState.knowledgePoints, learningState.subjects],
  );


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

  const clearActiveRequest = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    activeAbortRef.current = null;
  }, []);

  const refreshAiMode = useCallback(async () => {
    try {
      const status = await fetchAIConfig();
      setAiMode(status.mode);
    } catch {
      setAiMode('platform');
    }
  }, []);

  useEffect(() => {
    refreshAiMode();
    fetchTruthStatus().then(setTruthStatus).catch(() => setTruthStatus(null));
    return () => {
      activeAbortRef.current?.abort();
      clearActiveRequest();
    };
  }, [clearActiveRequest, refreshAiMode]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, streamingMsgId]);

  const sendMessage = useCallback(async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query || isLoading || streamingMsgId) return;

    activeAbortRef.current?.abort();
    clearActiveRequest();
    const abortController = new AbortController();
    activeAbortRef.current = abortController;
    timeoutRef.current = setTimeout(() => abortController.abort(), CHAT_REQUEST_TIMEOUT_MS);

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
    aiChatDispatch({ type: 'AI_SET_LOADING', payload: true });
    setStreamingMsgId(aiMsgId);

    try {
      const learningContext = buildAILearningContext({
        query,
        user: userState.user,
        subjects: learningState.subjects,
        chapters: learningState.chapters,
        knowledgePoints: learningState.knowledgePoints,
        questions: learningState.questions,
        wrongRecords: learningState.wrongRecords,
        todayReviewItems: learningState.todayReviewItems,
        todayNewItems: learningState.todayNewItems,
      });
      const { stream, relatedKpIds } = await askQuestionStreaming(
        query,
        learningState.knowledgePoints,
        messages,
        abortController.signal,
        learningContext,
      );

      let fullContent = '';
      for await (const chunk of stream) {
        fullContent += chunk;
        aiChatDispatch({ type: 'AI_UPDATE_STREAMING_MESSAGE', payload: { id: aiMsgId, content: fullContent } });
      }

      if (!fullContent.trim()) {
        throw new Error(EMPTY_AI_RESPONSE);
      }

      // 豆包模式不需要检测本地后端
      const config = getAIConfig();
      if (config.provider === 'douban') {
        setBackendMode('online');
      } else {
        checkBackendAvailable().then(ok => setBackendMode(ok ? 'online' : 'offline'));
        refreshAiMode();
      }

      if (relatedKpIds.length > 0) {
        const questionResult = await generateQuiz(
          relatedKpIds,
          learningState.knowledgePoints,
          learningState.questions,
          learningContext,
        );
        if (questionResult.question) {
          aiChatDispatch({ type: 'AI_ADD_GENERATED_QUESTION', payload: questionResult.question });
          setGeneratedQuestions(prev => ({ ...prev, [aiMsgId]: questionResult }));
        }
      }
    } catch (e) {
      let errorMsg = GENERIC_AI_ERROR;
      if (e instanceof Error) {
        errorMsg = abortController.signal.aborted ? TIMEOUT_AI_ERROR : e.message || GENERIC_AI_ERROR;
        console.error('AI chat error:', e);
      }
      setBackendMode('offline');
      aiChatDispatch({
        type: 'AI_UPDATE_STREAMING_MESSAGE',
        payload: { id: aiMsgId, content: errorMsg },
      });
    } finally {
      if (activeAbortRef.current === abortController) {
        clearActiveRequest();
      }
      setStreamingMsgId(null);
      aiChatDispatch({ type: 'AI_SET_LOADING', payload: false });
    }
  }, [isLoading, streamingMsgId, messages, userState.user, learningState.subjects, learningState.chapters, learningState.knowledgePoints, learningState.questions, learningState.wrongRecords, learningState.todayReviewItems, learningState.todayNewItems, aiChatDispatch, clearActiveRequest, refreshAiMode]);

  const sendTruthMessage = useCallback(async (rawQuery: string, filter?: TruthSearchFilter) => {
    const query = rawQuery.trim();
    if (!query || isLoading || streamingMsgId) return;
    const timestamp = Date.now();
    aiChatDispatch({
      type: 'AI_SEND_MESSAGE',
      payload: {
        id: `truth-user-${timestamp}`,
        role: 'user',
        content: query,
        timestamp: new Date().toISOString(),
      },
    });
    try {
      const result = await searchTruth(query, filter);
      const content = result.clarification
        ? '需要确认一个关键条件，确认后系统才会检索图片。'
        : result.total > 0
          ? `已从已发布图片库中找到 ${result.total} 张完全匹配的热成像图片。`
          : '已完成严格检索，但没有找到满足全部条件的图片。';
      aiChatDispatch({
        type: 'AI_RECEIVE_MESSAGE',
        payload: {
          id: `truth-ai-${timestamp}`,
          role: 'ai',
          content,
          timestamp: new Date().toISOString(),
          truthResult: result,
        },
      });
    } catch (error) {
      aiChatDispatch({
        type: 'AI_RECEIVE_MESSAGE',
        payload: {
          id: `truth-error-${timestamp}`,
          role: 'ai',
          content: error instanceof Error ? error.message : '求真检索失败，请稍后重试。',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }, [aiChatDispatch, isLoading, streamingMsgId]);

  useEffect(() => {
    const pageQuestionContext = typeof userState.pageParams.questionContext === 'string'
      ? userState.pageParams.questionContext.trim()
      : '';
    const questionContext = embedded
      ? embeddedQuestionContext?.text.trim() || ''
      : pageQuestionContext;
    const questionContextId = embedded
      ? embeddedQuestionContext?.id || ''
      : questionContext;
    if (!questionContext || !questionContextId || handledQuestionContextRef.current === questionContextId) return;
    if (isLoading || streamingMsgId) return;

    handledQuestionContextRef.current = questionContextId;
    void sendMessage(questionContext);
    if (!embedded) {
      setTimeout(() => {
        navigate('ai-chat', {});
      }, 100);
    }
  }, [embedded, embeddedQuestionContext, isLoading, navigate, sendMessage, streamingMsgId, userState.pageParams.questionContext]);

  const handleSend = useCallback(() => {
    const query = input.trim();
    if (!query || isLoading || streamingMsgId) return;
    if (!embedded && activeMode === 'study') {
      if (!aiStudyAccess.unlocked) return;
      setInput('');
      navigate('ai-study', {
        goal: query,
        autoGenerate: '1',
        ...(studySubjectId ? { scopeSubjectId: studySubjectId } : {}),
      });
      return;
    }
    if (activeMode === 'truth') {
      setInput('');
      void sendTruthMessage(query);
      return;
    }
    setInput('');
    void sendMessage(query);
  }, [activeMode, aiStudyAccess.unlocked, embedded, input, isLoading, navigate, studySubjectId, sendMessage, sendTruthMessage, streamingMsgId]);

  const handleRequestQuiz = async (aiMessageId: string, content: string) => {
    if (generatedQuestions[aiMessageId]) return;

    const relatedKps = learningState.knowledgePoints.filter(kp =>
      content.includes(kp.name) || kp.name.split('').some(ch => content.includes(ch) && ch.length > 1)
    );
    const kpIds = relatedKps.length > 0
      ? relatedKps.map(kp => kp.id)
      : learningState.knowledgePoints.slice(0, 3).map(kp => kp.id);

    const learningContext = buildAILearningContext({
      query: content,
      user: userState.user,
      subjects: learningState.subjects,
      chapters: learningState.chapters,
      knowledgePoints: learningState.knowledgePoints,
      questions: learningState.questions,
      wrongRecords: learningState.wrongRecords,
      todayReviewItems: learningState.todayReviewItems,
      todayNewItems: learningState.todayNewItems,
    });
    const questionResult = await generateQuiz(kpIds, learningState.knowledgePoints, learningState.questions, learningContext);
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
    const name = firstLine.length > 20 ? firstLine.slice(0, 20) + '...' : firstLine;

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
        nextReviewAt: null,   // 首次学习后由 FSRS 调度
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
    activeAbortRef.current?.abort();
    clearActiveRequest();
    aiChatDispatch({ type: 'AI_CLEAR_CHAT' });
    setGeneratedQuestions({});
    setStreamingMsgId(null);
  };

  const modeLabel = backendMode === 'online'
    ? (aiMode === 'custom' ? '自定义 AI' : '平台 AI')
    : '离线兜底';

  return (
    <div className={embedded ? 'relative flex h-full min-h-0 flex-col bg-bg' : 'absolute inset-0 flex flex-col bg-bg'}>
      {embedded ? (
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="text-sm font-bold text-text-primary">AI 助手</div>
            <div className="mt-0.5 text-[11px] text-text-muted">侧边学习问答</div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button onClick={handleClear} className="text-text-muted active:opacity-60">
                <Trash2 size={18} />
              </button>
            )}
            <button onClick={() => setShowSettings(true)} className="text-text-muted active:opacity-60">
              <Settings2 size={18} />
            </button>
            {onClose && (
              <button onClick={onClose} className="text-text-muted active:opacity-60" aria-label="关闭 AI 侧栏">
                <X size={19} />
              </button>
            )}
          </div>
        </div>
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
        <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full ${backendMode === 'online'
            ? 'bg-green-50 text-green-600'
            : backendMode === 'offline'
              ? 'bg-amber-50 text-amber-600'
              : 'bg-gray-50 text-gray-400'
          }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${backendMode === 'online' ? 'bg-green-500' :
              backendMode === 'offline' ? 'bg-amber-500' : 'bg-gray-300'
            }`} />
          {backendMode === 'checking' ? '检测中...' : modeLabel}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
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
              {(activeMode === 'study'
                ? ['学习物理化学', '系统掌握抗体与免疫', '从零学习高等数学']
                : activeMode === 'truth'
                  ? ['大黄，给药3天，雌鼠', '大黄，停药后1天，雌鼠', '查询给药第5天的热成像图']
                  : ['核酸的功能是什么？', '什么是细胞的结构？', '圆周的结构特点']
              ).map(q => (
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
                onTruthClarify={(phase: TruthPhase) => {
                  if (!msg.truthResult) return;
                  void sendTruthMessage(msg.truthResult.query, { ...msg.truthResult.filter, phase });
                }}
              />
            ))}
            {isLoading && !streamingMsgId && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className={`relative shrink-0 border-t border-border bg-white px-4 py-3 ${embedded ? '' : 'pb-[calc(12px+env(safe-area-inset-bottom))]'}`}>
        {!embedded && modeMenuOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              aria-label="关闭模式菜单"
              onClick={() => setModeMenuOpen(false)}
            />
            <div className="absolute bottom-[calc(100%-2px)] left-4 z-50 w-[min(320px,calc(100%-32px))] overflow-hidden rounded-2xl border border-border bg-white p-2 shadow-2xl">
              <button
                type="button"
                onClick={() => {
                  setActiveMode('chat');
                  setModeMenuOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-gray-50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <MessageCircle size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-text-primary">普通问答</span>
                  <span className="mt-0.5 block text-xs text-text-muted">自由提问、解释和生成练习</span>
                </span>
                {activeMode === 'chat' && <Check size={17} className="text-primary" />}
              </button>
              {!embedded && (
                <button
                  type="button"
                  disabled={!aiStudyAccess.unlocked}
                  onClick={() => {
                    if (!aiStudyAccess.unlocked) return;
                    setActiveMode('study');
                    setModeMenuOpen(false);
                  }}
                  className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    {aiStudyAccess.unlocked ? <BookOpen size={18} /> : <Lock size={17} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-bold text-text-primary">
                      学习模式
                      {!aiStudyAccess.unlocked && <span className="text-[10px] text-text-muted">Lv.{AI_STUDY_UNLOCK_LEVEL}</span>}
                    </span>
                    <span className="mt-0.5 block text-xs text-text-muted">规划 → 教学 → 练习 → 复习</span>
                  </span>
                  {activeMode === 'study' && <Check size={17} className="text-primary" />}
                </button>
              )}
              {truthStatus?.enabled && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('truth');
                    setModeMenuOpen(false);
                  }}
                  className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-cyan-50"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                    <ScanSearch size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-text-primary">求真模式</span>
                    <span className="mt-0.5 block text-xs text-text-muted">严格匹配已发布的真实实验图片</span>
                  </span>
                  {activeMode === 'truth' && <Check size={17} className="text-primary" />}
                </button>
              )}
              {!embedded && (
                <>
                  <div className="my-2 h-px bg-border" />
                  <button
                    type="button"
                    onClick={() => {
                      setModeMenuOpen(false);
                      navigate('ai-study-summaries');
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-violet-600 hover:bg-violet-50"
                  >
                    <History size={15} />
                    查看学习总结
                  </button>
                </>
              )}
              {truthStatus?.isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setModeMenuOpen(false);
                    navigate('truth-admin');
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-cyan-700 hover:bg-cyan-50"
                >
                  <Upload size={15} />
                  管理求真图片库
                </button>
              )}
            </div>
          </>
        )}
        {!embedded && (
          <div className="mb-2 flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setModeMenuOpen(open => !open)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-bold text-text-secondary shadow-sm"
            >
              {activeMode === 'study'
                ? <BookOpen size={14} className="text-emerald-600" />
                : activeMode === 'truth'
                  ? <ScanSearch size={14} className="text-cyan-700" />
                  : <MessageCircle size={14} className="text-violet-600" />}
              {activeMode === 'study' ? '学习模式' : activeMode === 'truth' ? '求真模式' : '问答'}
              <ChevronDown size={13} className={modeMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {!embedded && activeMode === 'study' && (
              <>
                <label className="relative min-w-0 flex-1">
                  <select
                    value={studySubjectId}
                    onChange={event => setStudySubjectId(event.target.value)}
                    className="w-full max-w-[180px] appearance-none truncate rounded-lg border border-border bg-white py-1.5 pl-2.5 pr-7 text-xs font-semibold text-text-secondary outline-none disabled:opacity-50"
                    aria-label="限定学习范围"
                  >
                    <option value="">全部知识库</option>
                    {studySubjects.map(subject => (
                      <option key={subject.id} value={subject.id}>{subject.icon} {subject.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted" />
                </label>
                <button
                  type="button"
                  onClick={() => navigate('ai-study')}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700"
                  aria-label="继续未完成的 AI 学习计划"
                >
                  <History size={13} />
                  <span className="sm:hidden">续学</span>
                  <span className="hidden sm:inline">继续学习</span>
                </button>
              </>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={!embedded && activeMode === 'study'
              ? '描述这次想学习的内容…'
              : activeMode === 'truth'
                ? '输入药物、给药/停药阶段、时间和性别...'
                : '输入你的问题...'}
            className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || (!embedded && activeMode === 'study' && !aiStudyAccess.unlocked)}
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
