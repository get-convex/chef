import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useStore } from '@nanostores/react';
import type { ConvexReactClient } from 'convex/react';
import { atom } from 'nanostores';
import { setLocalStorage, getLocalStorage } from '~/lib/persistence';
import { removeCodeFromUrl } from '~/lib/stores/convex';

export function useConvexSessionIdOrNullOrLoading(): Id<'sessions'> | null | undefined {
  const sessionId = useStore(sessionIdStore);
  return sessionId;
}

export function useConvexSessionId(): Id<'sessions'> {
  const sessionId = useStore(sessionIdStore);
  if (sessionId === undefined || sessionId === null) {
    throw new Error('Session ID is not set');
  }
  return sessionId;
}

export async function waitForConvexSessionId(caller?: string): Promise<Id<'sessions'>> {
  return new Promise((resolve) => {
    const sessionId = sessionIdStore.get();
    if (sessionId !== null && sessionId !== undefined) {
      resolve(sessionId);
      return;
    }
    if (caller) {
      console.log(`[${caller}] Waiting for session ID...`);
    }
    const unsubscribe = sessionIdStore.subscribe((sessionId) => {
      if (sessionId !== null && sessionId !== undefined) {
        unsubscribe();
        resolve(sessionId);
      }
    });
  });
}
const SESSION_ID_KEY = 'sessionIdForConvex';
export const sessionIdStore = atom<Id<'sessions'> | null | undefined>(undefined);

export function setInitialConvexSessionId(
  convex: ConvexReactClient,
  args: {
    codeFromLoader: string | null;
    flexAuthMode: 'InviteCode' | 'ConvexOAuth';
  },
) {
  function setSessionId(sessionId: Id<'sessions'> | null) {
    setLocalStorage(SESSION_ID_KEY, sessionId);
    sessionIdStore.set(sessionId);
  }

  if (args.codeFromLoader && args.flexAuthMode === 'InviteCode') {
    convex.mutation(api.sessions.getSession, { code: args.codeFromLoader }).then((sessionId) => {
      if (sessionId) {
        setSessionId(sessionId as Id<'sessions'>);
        removeCodeFromUrl();
      }
    });
    return;
  }

  const sessionIdFromLocalStorage = getLocalStorage(SESSION_ID_KEY);
  if (sessionIdFromLocalStorage) {
    convex
      .query(api.sessions.verifySession, {
        sessionId: sessionIdFromLocalStorage as Id<'sessions'>,
        flexAuthMode: args.flexAuthMode,
      })
      .then((validatedSessionId) => {
        if (validatedSessionId) {
          setSessionId(sessionIdFromLocalStorage as Id<'sessions'>);
        } else {
          setSessionId(null);
        }
      });
    return;
  }

  if (args.flexAuthMode === 'ConvexOAuth') {
    convex
      .mutation(api.sessions.startSession)
      .then((sessionId) => {
        setSessionId(sessionId);
      })
      .catch((error) => {
        setSessionId(null);
        console.error('Error starting session', error);
      });
    return;
  }

  // If there's not a sessionId in local storage or from the loader, set it to null
  sessionIdStore.set(null);
}

export async function setConvexSessionIdFromCode(
  convex: ConvexReactClient,
  code: string,
  onError: (error: Error) => void,
) {
  convex
    .mutation(api.sessions.getSession, { code })
    .then((sessionId) => {
      sessionIdStore.set(sessionId);
      setLocalStorage(SESSION_ID_KEY, sessionId);
    })
    .catch((error) => {
      sessionIdStore.set(null);
      onError(error);
    });
}
