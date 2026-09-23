import { useState } from 'react';
import type { AIStudyTutorContext } from '@/types';
import { useUser } from '@/store/UserContext';
import ConversationPanel from '@/features/ai/ConversationPanel';

export default function StudyTutorPanel({ context, onClose }: { context: AIStudyTutorContext; onClose?: () => void }) {
  const { userState } = useUser();
  return <TutorThread key={`${userState.user?.id}:${context.threadId}`} context={context} onClose={onClose} owner={userState.user?.id || ''} />;
}
function TutorThread({ context, onClose, owner }: { context: AIStudyTutorContext; onClose?: () => void; owner: string }) {
  const key = `ai:tutor:${owner}:${context.threadId}`;
  const [id] = useState(() => sessionStorage.getItem(key) || undefined);
  return <ConversationPanel conversationId={id} context={context} kind="study_tutor" onClose={onClose} onCreated={value => sessionStorage.setItem(key, value)} />;
}
