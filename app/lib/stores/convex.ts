import type { Id } from '@convex/_generated/dataModel';
import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { getLocalStorage, setLocalStorage } from '~/lib/persistence';
import type { ConvexReactClient } from 'convex/react';
import { api } from '@convex/_generated/api';
import { CONVEX_INVITE_CODE_QUERY_PARAM } from '~/lib/persistence/convex';
import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';

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

export async function waitForConvexSessionId(caller?: string): Promise<Id<'sessions'>> {
  return new Promise((resolve) => {
    const sessionId = sessionIdStore.get();
    if (sessionId !== null && sessionId !== undefined) {
      resolve(sessionId);
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
const VITE_PROVISION_HOST = import.meta.env.VITE_PROVISION_HOST || 'https://api.convex.dev';

export function useTeamsInitializer() {
  const { getAccessTokenSilently } = useAuth0();
  useEffect(() => {
    void fetchTeams(getAccessTokenSilently);
  }, [getAccessTokenSilently]);
}

async function fetchTeams(
  getAccessTokenSilently: ReturnType<typeof useAuth0>['getAccessTokenSilently'],
) {
  let teams: ConvexTeam[];
  await waitForConvexSessionId('fetchTeams');
  try {
    const tokenResponse = await getAccessTokenSilently({
      detailedResponse: true,
    });
    const response = await fetch(`${VITE_PROVISION_HOST}/api/dashboard/teams`, {
      headers: {
        Authorization: `Bearer ${tokenResponse.id_token}`,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to fetch teams: ${response.statusText}: ${body}`);
    }
    teams = await response.json();
  } catch (error) {
    console.error('Error fetching teams:', error);
    return;
  }
  teamsStore.set(teams);
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
  setLocalStorage(SELECTED_TEAM_SLUG_KEY, teamSlug);
  selectedTeamSlugStore.set(teamSlug);
}

export function useSelectedTeamSlug(): string | null {
  const selectedTeamSlug = useStore(selectedTeamSlugStore);
  return selectedTeamSlug;
}

export async function waitForSelectedTeamSlug(caller?: string): Promise<string> {
  return new Promise((resolve) => {
    const selectedTeamSlug = selectedTeamSlugStore.get();
    if (selectedTeamSlug !== null) {
      resolve(selectedTeamSlug);
      return;
    }
    if (caller) {
      console.log(`[${caller}] Waiting for selected team slug...`);
    }
    const unsubscribe = selectedTeamSlugStore.subscribe((selectedTeamSlug) => {
      if (selectedTeamSlug !== null) {
        unsubscribe();
        resolve(selectedTeamSlug);
      }
    });
  });
}
