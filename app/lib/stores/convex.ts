import type { Id } from '@convex/_generated/dataModel';
import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { getLocalStorage, setLocalStorage } from '~/lib/persistence';
import { ConvexReactClient } from 'convex/react';
import { api } from '@convex/_generated/api';
import { CONVEX_INVITE_CODE_QUERY_PARAM } from '~/lib/persistence/convex';

export type ConvexTeam = {
  id: string;
  name: string;
  slug: string;
};

export const teamsStore = atom<ConvexTeam[] | null>(null);

export type ConvexProject = {
  token: string;
  deploymentName: string;
  deploymentUrl: string;
  projectSlug: string;
  teamSlug: string;
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

const SELECTED_TEAM_SLUG_KEY = 'selectedConvexTeamSlug';
export const selectedTeamSlugStore = atom<string | null>(null);

export function useSelectedTeamSlug(): string | null {
  const selectedTeamSlug = useStore(selectedTeamSlugStore);
  return selectedTeamSlug;
}

export function initializeSelectedTeamSlug(teams: ConvexTeam[]) {
  const teamSlugFromLocalStorage = getLocalStorage(SELECTED_TEAM_SLUG_KEY);
  if (teamSlugFromLocalStorage) {
    const team = teams.find((team) => team.slug === teamSlugFromLocalStorage);
    if (team) {
      selectedTeamSlugStore.set(teamSlugFromLocalStorage);
      setLocalStorage(SELECTED_TEAM_SLUG_KEY, teamSlugFromLocalStorage);
      return;
    }
  }
  if (teams.length > 0) {
    selectedTeamSlugStore.set(teams[0].slug);
    setLocalStorage(SELECTED_TEAM_SLUG_KEY, teams[0].slug);
    return;
  }
  console.error('Unexpected state -- no teams found');
  selectedTeamSlugStore.set(null);
  setLocalStorage(SELECTED_TEAM_SLUG_KEY, null);
}

export function setSelectedTeamSlug(teamSlug: string | null) {
  selectedTeamSlugStore.set(teamSlug);
  setLocalStorage(SELECTED_TEAM_SLUG_KEY, teamSlug);
}
