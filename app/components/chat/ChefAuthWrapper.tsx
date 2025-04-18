import { useConvex } from 'convex/react';

import { useConvexAuth } from 'convex/react';
import { createContext, useContext, useEffect, useRef } from 'react';

import { sessionIdStore } from '~/lib/stores/sessionId';

import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import type { Id } from '@convex/_generated/dataModel';
import { api } from '@convex/_generated/api';
import { toast } from 'sonner';
import { useAuth0 } from '@auth0/auth0-react';
import { fetchOptIns } from '~/lib/convexOptins';

type ChefAuthState =
  | {
      kind: 'loading';
    }
  | {
      kind: 'unauthenticated';
    }
  | {
      kind: 'fullyLoggedIn';
      sessionId: Id<'sessions'>;
    };

const ChefAuthContext = createContext<{
  state: ChefAuthState;
}>(null as unknown as { state: ChefAuthState });

export function useChefAuth() {
  const state = useContext(ChefAuthContext);
  if (state === null) {
    throw new Error('useChefAuth must be used within a ChefAuthProvider');
  }
  return state.state;
}

export function useChefAuthContext() {
  const state = useContext(ChefAuthContext);
  if (state === null) {
    throw new Error('useChefAuth must be used within a ChefAuthProvider');
  }
  return state;
}

export const ChefAuthProvider = ({
  children,
  redirectIfUnauthenticated,
}: {
  children: React.ReactNode;
  redirectIfUnauthenticated: boolean;
}) => {
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const convex = useConvex();
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const hasAlertedAboutOptIns = useRef(false);
  const { getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    function setSessionId(sessionId: Id<'sessions'> | null) {
      setSessionIdInLocalStorage(sessionId);
      sessionIdStore.set(sessionId);
    }

    const isUnauthenticated = !isAuthenticated && !isConvexAuthLoading;

    if (sessionId === undefined && isUnauthenticated) {
      setSessionId(null);
      return;
    }

    if (sessionId !== null && isUnauthenticated) {
      setSessionId(null);
      return;
    }

    async function verifySession() {
      const sessionId = getSessionIdFromLocalStorage();
      if (sessionId) {
        // Seems like Auth0 does not automatically refresh its state, so call this to kick it
        try {
          // Call this to prove that Auth0 is set up
          await getAccessTokenSilently({
            detailedResponse: true,
          });
        } catch (_e) {
          console.error('Unable to fetch access token from Auth0');
          return;
        }
        if (!isAuthenticated) {
          // Wait until auth is propagated to Convex before we try to verify the session
          return;
        }
        let isValid: boolean = false;
        try {
          isValid = await convex.query(api.sessions.verifySession, {
            sessionId,
            flexAuthMode: 'ConvexOAuth',
          });
        } catch (error) {
          console.error('Error verifying session', error);
          toast.error('Unexpected error verifying credentials');
          setSessionId(null);
        }
        if (isValid) {
          const optIns = await fetchOptIns(convex);
          if (optIns.kind === 'loaded' && optIns.optIns.length === 0) {
            setSessionId(sessionId);
          }
          if (!hasAlertedAboutOptIns.current && optIns.kind === 'loaded' && optIns.optIns.length > 0) {
            toast.info('Please accept the Convex Terms of Service to continue');
            hasAlertedAboutOptIns.current = true;
          }
          if (hasAlertedAboutOptIns.current && optIns.kind === 'error') {
            toast.error('Unexpected error setting up your account.');
          }
        } else {
          // Clear it, the next loop around we'll try creating a new session
          // if we're authenticated.
          setSessionId(null);
        }
      }

      if (isAuthenticated) {
        try {
          const sessionId = await convex.mutation(api.sessions.startSession);
          setSessionId(sessionId);
        } catch (error) {
          console.error('Error creating session', error);
          setSessionId(null);
        }
      }
    }
    void verifySession();
  }, [convex, sessionId, isAuthenticated, isConvexAuthLoading, getAccessTokenSilently]);

  const isLoading = sessionId === undefined || isConvexAuthLoading;
  const isUnauthenticated = sessionId === null || !isAuthenticated;
  const state: ChefAuthState = isLoading
    ? { kind: 'loading' }
    : isUnauthenticated
      ? { kind: 'unauthenticated' }
      : { kind: 'fullyLoggedIn', sessionId: sessionId as Id<'sessions'> };

  if (redirectIfUnauthenticated && state.kind === 'unauthenticated') {
    console.log('redirecting to /');
    // Hard navigate to avoid any potential state leakage
    window.location.href = '/';
  }

  return <ChefAuthContext.Provider value={{ state }}>{children}</ChefAuthContext.Provider>;
};

export const SESSION_ID_KEY = 'sessionIdForConvex';

function getSessionIdFromLocalStorage() {
  const sessionId = localStorage.getItem(SESSION_ID_KEY);
  if (sessionId === null) {
    return null;
  }
  return sessionId as Id<'sessions'>;
}

function setSessionIdInLocalStorage(sessionId: Id<'sessions'> | null) {
  if (sessionId === null) {
    localStorage.removeItem(SESSION_ID_KEY);
  } else {
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }
}
