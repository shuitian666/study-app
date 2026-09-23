import { useEffect, useRef, useState } from 'react';
import { Send, Square, X, BookPlus, Sparkles } from 'lucide-react';
import './styles.css';
import { useUser } from '@/store/UserContext';
import { useLearning } from '@/store/LearningContext';
import { useTheme } from '@/store/ThemeContext';
import { buildAILearningContext } from '@/utils/aiLearningContext';
import { generateQuiz } from '@/services/aiService';
import StudyRichText from '@/components/ai/StudyRichText';
import InlineQuizCard from '@/pages/AIChat/InlineQuizCard';
import type { AIStudyTutorContext, Question } from '@/types';
import { aiRequest, streamConversation, type ConversationKind, type Message } from './api';

interface Props { conversationId?: string; context?: AIStudyTutorContext; kind?: ConversationKind; initialPrompt?: string; onClose?: () => void; onCreated?: (id: string) => void }
export default function ConversationPanel({ conversationId, context, kind = 'general', initialPrompt, onClose, onCreated }: Props) {
  const { userState, navigate } = useUser();
  const { learningState, learningDispatch } = useLearning();
  const { theme } = useTheme();
  const [id, setId] = useState(conversationId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialPrompt || context?.initialPrompt || '');
  const [loading, setLoading] = useState(Boolean(conversationId));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const [draft, setDraft] = useState<{ content: string; name: string; subject: string; chapter: string } | null>(null);
  const [quiz, setQuiz] = useState<Question | null>(null);
  const [generating, setGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const owner = userState.user?.id;
  useEffect(() => {
    const controller = new AbortController();
    setId(conversationId); setMessages([]); setError(''); setLoading(Boolean(conversationId));
    if (conversationId) aiRequest<{ messages: Message[] }>(`/ai/conversations/${conversationId}/messages`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setMessages(data.messages); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); abortRef.current?.abort(); };
  }, [conversationId, owner]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }, [messages]);
  function learningContext(query: string) { return buildAILearningContext({ query, user: userState.user, ...learningState }); }
  async function send(query = input.trim()) {
    if (!query || lock.current || !owner) return;
    lock.current = true; setSending(true); setError(''); setInput(''); setLastQuery(query);
    const controller = new AbortController(); abortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 120000);
    const requestId = crypto.randomUUID();
    const replyId = `${requestId}-reply`;
    let currentId = id, content = '';
    try {
      if (!currentId) {
        const data = await aiRequest<{ conversation: { id: string } }>('/ai/conversations', { method: 'POST', body: JSON.stringify({ kind, title: context?.knowledgePointName || query.slice(0, 40), context }), signal: controller.signal });
        currentId = data.conversation.id; setId(currentId); onCreated?.(currentId);
      }
      setMessages(prev => [...prev, { id: requestId, role: 'user', content: query, status: 'complete', createdAt: new Date().toISOString() }, { id: replyId, role: 'assistant', content: '', status: 'streaming', createdAt: new Date().toISOString() }]);
      for await (const chunk of streamConversation(currentId, { query, context, learningContext: learningContext(query) }, controller.signal, requestId)) {
        content += chunk;
        setMessages(prev => prev.map(m => m.id === replyId ? { ...m, content } : m));
      }
      setMessages(prev => prev.map(m => m.id === replyId ? { ...m, status: 'complete' } : m));
    } catch (e) {
      setError(controller.signal.aborted ? '生成已停止，已保留收到的内容。' : e instanceof Error ? e.message : '发送失败，请重试');
      setMessages(prev => prev.map(m => m.id === replyId ? { ...m, status: controller.signal.aborted ? 'cancelled' : content ? 'interrupted' : 'failed' } : m));
    } finally { clearTimeout(timer); lock.current = false; setSending(false); window.dispatchEvent(new Event('ai:updated')); }
  }
  async function practice(content: string) {
    setGenerating(true); setError('');
    try {
      const ctx = learningContext(content);
      const ids = ctx.focusKnowledgePoints.map(k => k.id);
      if (!ids.length) throw new Error('请先选择或添加相关知识点，再生成练习。');
      const result = await generateQuiz(ids, learningState.knowledgePoints, learningState.questions, ctx);
      if (result.question) { learningDispatch({ type: 'AI_ADD_GENERATED_QUESTION', payload: result.question }); setQuiz(result.question); }
    } catch (e) { setError(e instanceof Error ? e.message : '生成失败'); }
    finally { setGenerating(false); window.dispatchEvent(new Event('ai:updated')); }
  }
  function saveKnowledge() {
    if (!draft?.name.trim() || !draft.subject || !draft.chapter) return;
    learningDispatch({ type: 'ADD_KNOWLEDGE_POINT', payload: { id: `kp-ai-${crypto.randomUUID()}`, subjectId: draft.subject, chapterId: draft.chapter, name: draft.name.trim(), explanation: draft.content, proficiency: 'none', lastReviewedAt: null, nextReviewAt: null, reviewCount: 0, createdAt: new Date().toISOString(), source: 'ai' } });
    setDraft(null);
  }
  return <section className="flex h-full min-h-0 flex-col" style={{ background: theme.bg, color: theme.textPrimary }}>
    <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
      <div><h2 className="font-bold">{kind === 'general' ? '问一问' : '学习导师'}</h2><p className="text-xs text-text-muted">{context?.knowledgePointName || '对话自动保存到当前账号'} · 每次 1 点</p></div>
      {onClose && <button className="ai-action" aria-label="关闭 AI" onClick={onClose}><X size={20} /></button>}
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
      {loading && <p role="status">正在读取对话…</p>}
      {!loading && !messages.length && <div className="py-10"><Sparkles className="mb-4 text-primary" /><h3 className="text-xl font-bold">从不理解的地方开始</h3><p className="mt-2 text-sm text-text-muted">{context?.question ? '已带入当前题目。提交答案前提供思路提示，提交后帮助复盘。' : '解释一个概念，拆解一道题，或换一种方式讲给你听。'}</p></div>}
      {messages.map(m => <article key={m.id} className={m.role === 'user' ? 'ml-8 rounded-2xl bg-primary p-4 text-white' : 'mr-3 rounded-2xl border border-border p-4'} style={m.role === 'assistant' ? { background: theme.bgCard } : undefined}>
        <p className="mb-1 text-xs opacity-60">{m.role === 'user' ? '你' : '智学助手'}</p>
        <div className="whitespace-pre-wrap break-words text-sm leading-7"><StudyRichText text={m.content || (m.status === 'streaming' ? '正在思考…' : '未生成回答')} /></div>
        {m.role === 'assistant' && m.status !== 'complete' && m.status !== 'streaming' && <p className="mt-2 text-xs text-text-muted">{m.status === 'cancelled' ? '已停止' : '回答未完成'}</p>}
        {m.role === 'assistant' && m.status === 'complete' && <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-2">
          <button className="ai-action text-xs" disabled={generating || sending} onClick={() => void practice(m.content)}><Sparkles size={14} />{generating ? '生成中…' : '练习一下 · 1 点'}</button>
          <button className="ai-action text-xs" onClick={() => setDraft({ content: m.content, name: m.content.split('\n')[0].slice(0, 50), subject: '', chapter: '' })}><BookPlus size={14} />加入知识库</button>
        </div>}
      </article>)}
      {quiz && <InlineQuizCard key={quiz.id} question={quiz} onAnswer={(correct, answers) => { if (!correct) learningDispatch({ type: 'ADD_WRONG_RECORD', payload: { id: `wr-${crypto.randomUUID()}`, questionId: quiz.id, wrongAnswers: answers, correctAnswers: quiz.correctAnswers, addedAt: new Date().toISOString(), reviewedCount: 0, lastReviewedAt: null } }); }} />}
      {draft && <form className="space-y-3 rounded-2xl border border-border p-4" onSubmit={e => { e.preventDefault(); saveKnowledge(); }}>
        <h3 className="font-bold">确认知识点</h3><label className="block text-sm">标题<input required className="ai-input" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <label className="block text-sm">内容<textarea required className="ai-input" rows={5} value={draft.content} onChange={e => setDraft({ ...draft, content: e.target.value })} /></label>
        <label className="block text-sm">学科<select required className="ai-input" value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value, chapter: '' })}><option value="">选择学科</option>{learningState.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="block text-sm">章节<select required className="ai-input" value={draft.chapter} onChange={e => setDraft({ ...draft, chapter: e.target.value })}><option value="">选择章节</option>{learningState.chapters.filter(c => c.subjectId === draft.subject).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {!learningState.subjects.length && <p className="text-sm">请先在知识库创建学科和章节。</p>}
        <div className="flex gap-2"><button type="submit" className="ai-action bg-primary text-white">确认加入</button><button type="button" className="ai-action" onClick={() => setDraft(null)}>取消</button></div>
      </form>}
      <div ref={endRef} />
    </div>
    {error && <div className="px-4 py-2 text-sm" role="alert"><p>{error}</p><div className="flex gap-2">{lastQuery && <button disabled={sending} className="ai-action" onClick={() => void send(lastQuery)}>重试上次问题</button>}<button className="ai-action" onClick={() => navigate('settings')}>AI 设置</button></div></div>}
    <form onSubmit={e => { e.preventDefault(); void send(); }} className="flex shrink-0 items-end gap-2 border-t border-border p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <textarea aria-label="向 AI 提问" className="ai-input max-h-36 flex-1 resize-y" rows={2} maxLength={8000} value={input} onChange={e => setInput(e.target.value)} placeholder={context?.mode === 'question_hint' ? '告诉我你卡在哪一步…' : '继续提问…'} />
      {sending ? <button type="button" className="ai-action" aria-label="停止生成" onClick={() => abortRef.current?.abort()}><Square size={18} /></button> : <button className="ai-action bg-primary text-white" disabled={!input.trim() || loading || !owner} aria-label="发送问题"><Send size={18} /></button>}
    </form>
  </section>;
}
