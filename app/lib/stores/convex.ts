import type { Id } from '@convex/_generated/dataModel';
import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { getLocalStorage, setLocalStorage } from '~/lib/persistence';
import { ConvexReactClient } from 'convex/react';
import { api } from '@convex/_generated/api';
import { CONVEX_INVITE_CODE_QUERY_PARAM } from '~/lib/persistence/convex';

export type ConvexProject = {
  token: string;
  deploymentName: string;
  deploymentUrl: string;
};

export const convexStore = atom<ConvexProject | null>(null);

export function waitForConvexProjectConnection(): Promise<ConvexProject> {
  return new Promise((resolve) => {
    if (convexStore.get() !== null) {
      resolve(convexStore.get()!);
      return;
    }

    const unsubscribe = convexStore.subscribe((project) => {
      if (project !== null) {
        unsubscribe();
        resolve(project);
      }
    });
  });
}

export const flexAuthModeStore = atom<'InviteCode' | 'ConvexOAuth' | null>(null);

export function useFlexAuthMode(): 'InviteCode' | 'ConvexOAuth' {
  const flexAuthMode = useStore(flexAuthModeStore);
  if (flexAuthMode === null) {
    throw new Error('Flex auth mode is not set');
  }
  return flexAuthMode;
}

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

const SESSION_ID_KEY = 'sessionIdForConvex';
export const sessionIdStore = atom<Id<'sessions'> | null | undefined>(undefined);

export function setInitialConvexSessionId(
  convex: ConvexReactClient,
  args: {
    codeFromLoader: string | undefined;
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

function removeCodeFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete(CONVEX_INVITE_CODE_QUERY_PARAM);
  window.history.replaceState({}, '', url);
}
const SELECTED_TEAM_SLUG_KEY = 'selectedConvexTeamSlug';

export function getSelectedTeamSlug(): string | null {
  return getLocalStorage(SELECTED_TEAM_SLUG_KEY);
}

export function setSelectedTeamSlug(teamSlug: string | null) {
  setLocalStorage(SELECTED_TEAM_SLUG_KEY, teamSlug);
}
