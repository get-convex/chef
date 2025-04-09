import type { Id } from '@convex/_generated/dataModel';
import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { getLocalStorage, setLocalStorage } from '~/lib/persistence';
import { type ConvexReactClient } from 'convex/react';
import { api } from '@convex/_generated/api';
import { CONVEX_INVITE_CODE_QUERY_PARAM } from '~/lib/persistence/convex';

export const flexAuthModeStore = atom<'InviteCode' | 'ConvexOAuth' | null>(null);

export function useFlexAuthMode(): 'InviteCode' | 'ConvexOAuth' {
  const flexAuthMode = useStore(flexAuthModeStore);
  if (flexAuthMode === null) {
    throw new Error('Flex auth mode is not set');
  }
  return flexAuthMode;
}

export function removeCodeFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete(CONVEX_INVITE_CODE_QUERY_PARAM);
  window.history.replaceState({}, '', url);
}

const VALID_ACCESS_CODE_KEY = 'validAccessCodeSessionId';

export async function setValidAccessCode(convex: ConvexReactClient, code: string | null): Promise<boolean> {
  const existing = getLocalStorage(VALID_ACCESS_CODE_KEY);
  if (existing) {
    let isValidSession: boolean = false;
    try {
      isValidSession = await convex.query(api.sessions.verifySession, {
        sessionId: existing as Id<'sessions'>,
        flexAuthMode: 'InviteCode',
      });
    } catch (_error) {
      setLocalStorage(VALID_ACCESS_CODE_KEY, null);
      return false;
    }
    if (isValidSession) {
      setLocalStorage(VALID_ACCESS_CODE_KEY, existing);
      return true;
    }
    setLocalStorage(VALID_ACCESS_CODE_KEY, null);
    return false;
  }
  if (code === null) {
    setLocalStorage(VALID_ACCESS_CODE_KEY, null);
    return false;
  }
  let sessionId: Id<'sessions'> | null = null;
  try {
    sessionId = await convex.mutation(api.sessions.getSession, { code });
  } catch (_error) {
    setLocalStorage(VALID_ACCESS_CODE_KEY, null);
    return false;
  }
  if (sessionId) {
    setLocalStorage(VALID_ACCESS_CODE_KEY, sessionId);
    return true;
  }
  setLocalStorage(VALID_ACCESS_CODE_KEY, null);
  return false;
}
