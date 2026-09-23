import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, MessageCircle, ScanSearch, Trash2, Settings2 } from 'lucide-react';
import { useTheme } from '@/store/ThemeContext';
import { useUser } from '@/store/UserContext';
import type { AIStudyTutorContext } from '@/types';
import LegacyChat from '@/pages/AIChat';
import TruthWorkspace from '@/features/truth/TruthWorkspace';
import ConversationPanel from './ConversationPanel';
import { aiRequest, type Bootstrap, type Conversation } from './api';
import './styles.css';

interface Props { embedded?: boolean; embeddedQuestionContext?: { id: string; text: string } | null; onClose?: () => void }
export default function AICenter(props: Props) {
  const { userState } = useUser();
  return <CenterContent key={userState.user?.id || 'guest'} {...props} />;
}
function CenterContent({ embedded, embeddedQuestionContext, onClose }: Props) {
  const { theme } = useTheme();
  const { userState, navigate } = useUser();
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState<Conversation | 'new' | null>(null);
  const truth = userState.pageParams.aiTool === 'truth';
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { setData(await aiRequest<Bootstrap>('/ai/bootstrap')); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : '读取失败，请重试'); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    aiRequest<Bootstrap>('/ai/bootstrap', { signal: controller.signal }).then(setData).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '读取失败，请重试'); });
    const load = () => void refresh(); window.addEventListener('ai:updated', load);
    return () => { controller.abort(); window.removeEventListener('ai:updated', load); };
  }, [refresh]);
  const legacyText = embeddedQuestionContext?.text || userState.pageParams.questionContext;
  if (truth) return <TruthWorkspace onClose={() => navigate('ai-chat', {})} />;
  if (data?.enabled === false) return <LegacyChat {...{ embedded, embeddedQuestionContext, onClose }} />;
  if (embedded || legacyText) {
    const context: AIStudyTutorContext | undefined = legacyText ? { threadId: embeddedQuestionContext?.id || 'legacy-context', mode: 'explain', goal: '解答当前学习问题', chapterName: '', knowledgePointId: '', knowledgePointName: '学习现场', sectionContent: String(legacyText) } : undefined;
    return <ConversationPanel key={context?.threadId || userState.user?.id} kind={context ? 'contextual_help' : 'general'} context={context} onClose={onClose || (() => navigate('ai-chat', {}))} />;
  }
  if (active) return <ConversationPanel key={typeof active === 'string' ? 'new' : active.id} conversationId={typeof active === 'string' ? undefined : active.id} kind={typeof active === 'string' ? 'general' : active.kind} onClose={() => { setActive(null); void refresh(); }} />;
  return <main className="h-full overflow-y-auto px-5 py-6 pb-24 md:px-8" style={{ background: theme.bg, color: theme.textPrimary }}>
    <div className="mx-auto max-w-4xl">
      <header className="mb-8 flex items-center justify-between"><button className="ai-action" onClick={() => navigate('home')}><ArrowLeft size={18} />返回</button><button className="ai-action" aria-label="AI 设置" onClick={() => navigate('settings')}><Settings2 size={20} /></button></header>
      <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-primary">你的学习搭档</p><h1 className="text-3xl font-extrabold tracking-tight">让每一个疑问，都有下一步。</h1><p className="mt-3 text-sm leading-6 text-text-muted">随时提问，按计划学习。做题时也能直接呼出助手。</p>
      {error && <div role="alert" className="my-5 rounded-2xl border border-border p-4"><p>{error}</p><button className="ai-action" onClick={() => void refresh()}>重新加载</button></div>}
      {!data && !error && <p role="status" className="my-6">正在同步学习记录…</p>}
      {data && <section className="my-6 rounded-2xl border border-border p-5" style={{ background: theme.bgCard }} aria-label="AI 使用额度">
        <div className="flex items-center justify-between gap-3"><h2 className="font-bold">Lv.{data.quota.level} · {data.config.mode === 'custom' ? '自定义 AI' : '平台 AI'}</h2><span className="text-xs text-text-muted">所有学习功能已开放</span></div>
        {data.config.mode === 'custom' ? <p className="mt-3 text-sm text-text-muted">使用自己的 Key，不消耗平台点数，模型费用由接口提供方收取。</p> : <div className="mt-4 grid gap-5 sm:grid-cols-2">{(['short', 'week'] as const).map(key => {
          const q = data.quota[key];
          return <div key={key}><div className="mb-2 flex justify-between text-sm"><span>{key === 'short' ? '最近 5 小时' : '最近 7 天'}</span><span><strong>{q.remaining}</strong> / {q.limit} 点</span></div><progress aria-label={`${key === 'short' ? '5小时' : '7天'}剩余额度`} className="h-1.5 w-full accent-primary" value={q.remaining} max={q.limit} /><p className="mt-2 text-xs text-text-muted">{q.restoresAt ? `最近恢复 ${new Date(q.restoresAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '额度充足，可以开始学习'}</p></div>;
        })}</div>}
        <details className="mt-4 text-xs text-text-muted"><summary className="cursor-pointer py-2">额度如何使用？</summary><p className="leading-6">问答、导师、解析、单题 1 点；练习组 2 点；学习计划和章节综合 3 点。等级越高，额度越多。历史阅读、保存和求真检索不扣点。</p></details>
      </section>}
      <section className="mt-6 grid gap-3 md:grid-cols-3" aria-label="AI 功能入口">
        {[{ title: '问一问', text: '解释概念、拆解难题，换个角度理解。', icon: MessageCircle, action: () => setActive('new' as const) }, { title: '陪我学', text: '从学习目标开始，一步步讲解、练习、复盘。', icon: BookOpen, action: () => navigate('ai-study') }, { title: '专业工具', text: data?.truth.enabled ? '查阅实验图库，对照图片与资料记录。' : '求真工具暂未开放。', icon: ScanSearch, action: () => navigate('ai-chat', { aiTool: 'truth' }), disabled: !data?.truth.enabled }].map(item => <button key={item.title} disabled={item.disabled} onClick={item.action} className="ai-entry rounded-2xl border border-border p-5 text-left disabled:opacity-50" style={{ background: theme.bgCard }}><div className="mb-5 flex items-center justify-between text-primary"><item.icon size={23} /><ArrowUpRight size={18} /></div><h2 className="font-bold text-lg">{item.title}</h2><p className="mt-2 text-sm leading-6 text-text-muted">{item.text}</p></button>)}
      </section>
      <section className="mt-9"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">接着上次继续</h2><button className="ai-action text-sm text-primary" onClick={() => navigate('ai-study-summaries')}>学习总结</button></div>
        {!!data?.sessions.length && <button className="mt-3 w-full rounded-2xl border border-border p-4 text-left" style={{ background: theme.bgCard }} onClick={() => navigate('ai-study')}><p className="font-semibold">{data.sessions[0].plan.subjectName}</p><p className="mt-1 text-xs text-text-muted">有 {data.sessions.length} 个未完成计划 · 继续学习</p></button>}
        {data && !data.conversations.length && <p className="mt-4 rounded-2xl border border-dashed border-border p-6 text-sm text-text-muted">还没有对话。从“问一问”开始，学习记录会保存在这里。</p>}
        <div className="mt-3 divide-y divide-border">{data?.conversations.map(c => <div key={c.id} className="flex items-center gap-2 py-3"><button className="min-w-0 flex-1 py-2 text-left" onClick={() => setActive(c)}><p className="truncate font-semibold">{c.title}</p><p className="mt-1 text-xs text-text-muted">{c.kind === 'general' ? '问一问' : '学习现场'} · {new Date(c.updatedAt).toLocaleDateString('zh-CN')}</p></button>{deleteId === c.id ? <><button className="ai-action text-xs text-red-600" onClick={async () => { try { await aiRequest(`/ai/conversations/${c.id}`, { method: 'DELETE' }); setDeleteId(null); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : '删除失败'); } }}>确认删除</button><button className="ai-action text-xs" onClick={() => setDeleteId(null)}>取消</button></> : <button aria-label={`删除对话 ${c.title}`} className="ai-action text-text-muted" onClick={() => setDeleteId(c.id)}><Trash2 size={16} /></button>}</div>)}</div>
      </section>
    </div>
  </main>;
}
