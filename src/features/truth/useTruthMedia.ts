import { useEffect, useState } from 'react';
import { fetchTruthBlob, TruthRequestError } from '@/services/truthService';
import { useUser } from '@/store/UserContext';

// No shared media cache: an account switch unmounts/aborts each consumer and
// revokes its object URL, including images opened before the switch.
export function useTruthMedia(src: string) {
  const { userState } = useUser();
  const accountId = userState.user?.id;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; url?: string; error?: Error }>({ key: '' });
  const key = `${accountId || ''}:${src}:${attempt}`;
  useEffect(() => {
    if (!accountId || !src) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    fetchTruthBlob(src, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setState({ key, url: objectUrl });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ key, error: error instanceof Error ? error : new Error('资料加载失败') });
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [accountId, key, src]);
  const current = state.key === key ? state : undefined;
  return {
    url: current?.url,
    error: current?.error,
    expired: current?.error instanceof TruthRequestError && current.error.status === 401,
    retry: () => setAttempt(value => value + 1),
  };
}
