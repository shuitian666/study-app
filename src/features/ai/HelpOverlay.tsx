import { useEffect, useRef, useState } from 'react';
import type { AIStudyTutorContext } from '@/types';
import { useUser } from '@/store/UserContext';
import ConversationPanel from './ConversationPanel';

export default function HelpOverlay() {
  const { userState } = useUser();
  return <AccountHelpOverlay key={userState.user?.id || 'guest'} />;
}
function AccountHelpOverlay() {
  const [conversationId, setConversationId] = useState<string>();
  const [context, setContext] = useState<AIStudyTutorContext | null>(null);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const conversations = useRef(new Map<string, string>());
  useEffect(() => {
    const show = (event: Event) => { const next = (event as CustomEvent<AIStudyTutorContext>).detail; trigger.current = document.activeElement as HTMLElement; setContext(next); setConversationId(conversations.current.get(next.threadId)); setOpen(true); };
    window.addEventListener('ai:help', show); return () => window.removeEventListener('ai:help', show);
  }, []);
  useEffect(() => {
    if (!open) return;
    dialog.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; trigger.current?.focus(); };
  }, [open]);
  if (!context || !open) return null;
  return <div className="fixed inset-0 z-[100] flex items-end justify-end bg-black/30 md:items-stretch" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="学习 AI 帮助" className="h-[88dvh] w-full overflow-hidden rounded-t-3xl shadow-2xl outline-none md:h-full md:w-[440px] md:rounded-none" onKeyDown={e => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'Tab') {
        const nodes = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea,input,select,a[href]');
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }}><ConversationPanel key={context.threadId} conversationId={conversationId} context={context} kind="contextual_help" onCreated={id => { conversations.current.set(context.threadId, id); }} onClose={() => setOpen(false)} /></div>
  </div>;
}
