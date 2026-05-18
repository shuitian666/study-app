import type { Dispatch } from 'react';
import type { AuthPayload } from '@/services/aiClient';
import type { GameAction } from './GameContext';
import type { UserAction } from './UserContext';

export function applyServerAccountPayload(
  payload: AuthPayload,
  userDispatch: Dispatch<UserAction>,
  gameDispatch: Dispatch<GameAction>,
) {
  userDispatch({ type: 'APPLY_SERVER_ACCOUNT_STATE', payload });
  gameDispatch({ type: 'APPLY_SERVER_ACCOUNT_STATE', payload });
}

export function logoutOnUnauthorized(err: unknown, userDispatch: Dispatch<UserAction>) {
  if (isUnauthorizedError(err)) {
    userDispatch({ type: 'LOGOUT' });
  }
}

export function isUnauthorizedError(err: unknown) {
  return (err as Error & { status?: number }).status === 401;
}
