import { useConvex } from 'convex/react';

import { useConvexAuth } from 'convex/react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { sessionIdStore } from '~/lib/stores/sessionId';

import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import type { Id } from '@convex/_generated/dataModel';
import { useLocalStorage } from '@uidotdev/usehooks';
import { api } from '@convex/_generated/api';
import { toast } from 'sonner';
import { useLoaderData } from '@remix-run/react';
import type { loader } from '~/routes/_index';
import { validateAccessCode } from '~/lib/stores/convex';
type ChefAuthState =
  | {
      kind: 'loading';
    }
  | {
      kind: 'unauthenticated';
    }
  | {
      kind: 'needsAccessCode';
    }
  | {
      kind: 'fullyLoggedIn';
      sessionId: Id<'sessions'>;
    };

const ChefAuthContext = createContext<{
  state: ChefAuthState;
  setAccessCode: (accessCode: Id<'sessions'> | null) => void;
}>(null as unknown as { state: ChefAuthState; setAccessCode: (accessCode: Id<'sessions'> | null) => void });

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

const SESSION_ID_KEY = 'sessionIdForConvex';
const VALID_ACCESS_CODE_KEY = 'validAccessCodeSessionId';

export const ChefAuthProvider = ({
  children,
  redirectIfUnauthenticated,
}: {
  children: React.ReactNode;
  redirectIfUnauthenticated: boolean;
}) => {
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const convex = useConvex();
  const { code: codeFromLoader } = useLoaderData<typeof loader>();
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const [sessionIdFromLocalStorage, setSessionIdFromLocalStorage] = useLocalStorage<Id<'sessions'> | null>(
    SESSION_ID_KEY,
    null,
  );
  const [localStorageEntry, setLocalStorageEntry] = useLocalStorage<Id<'sessions'> | null>(VALID_ACCESS_CODE_KEY, null);

  // We're gating access to Chef before general adoption. As a hack, we're reusing
  // the invite codes, but just no longer using the sessions they point to.
  const [hasValidCode, setHasValidCode] = useState(false);
  const setAccessCode = useCallback(
    (accessCode: Id<'sessions'> | null) => {
      setLocalStorageEntry(accessCode);
      setHasValidCode(!!accessCode);
    },
    [setLocalStorageEntry, setHasValidCode],
  );

  useEffect(() => {
    function setSessionId(sessionId: Id<'sessions'> | null) {
      setSessionIdFromLocalStorage(sessionId);
      sessionIdStore.set(sessionId);
    }

    if (sessionIdFromLocalStorage) {
      convex
        .query(api.sessions.verifySession, {
          sessionId: sessionIdFromLocalStorage as Id<'sessions'>,
          flexAuthMode: 'ConvexOAuth',
        })
        .then((validatedSessionId) => {
          if (validatedSessionId) {
            setSessionId(sessionIdFromLocalStorage as Id<'sessions'>);
          } else {
            // Clear it, the next loop around we'll try creating a new session
            // if we're authenticated.
            setSessionId(null);
          }
        })
        .catch((error) => {
          console.error('Error verifying session', error);
          toast.error('Unexpected error verifying credentials');
          setSessionId(null);
        });
      return;
    }

    const isUnauthenticated = !isAuthenticated && !isConvexAuthLoading;

    if (isUnauthenticated) {
      setSessionId(null);
      return;
    }

    if (isAuthenticated) {
      convex
        .mutation(api.sessions.startSession)
        .then((sessionId) => {
          setSessionId(sessionId);
        })
        .catch((error) => {
          setSessionId(null);
          console.error('Error starting session', error);
        });
    }
    return;
  }, [sessionId, isAuthenticated, isConvexAuthLoading, sessionIdFromLocalStorage, setSessionIdFromLocalStorage]);

  useEffect(() => {
    validateAccessCode(convex, { code: codeFromLoader ?? null, localStorageEntry }).then((accessCode) => {
      if (accessCode) {
        setAccessCode(accessCode);
      } else {
        setAccessCode(null);
      }
    });
  }, [codeFromLoader, localStorageEntry, setAccessCode]);

  const isLoading = sessionId === undefined || isConvexAuthLoading;
  const isUnauthenticated = sessionId === null || !isAuthenticated;
  const state: ChefAuthState = isLoading
    ? { kind: 'loading' }
    : isUnauthenticated
      ? { kind: 'unauthenticated' }
      : hasValidCode
        ? { kind: 'fullyLoggedIn', sessionId: sessionId as Id<'sessions'> }
        : { kind: 'needsAccessCode' };

  if (redirectIfUnauthenticated && state.kind === 'unauthenticated') {
    console.log('redirecting to /');
    // Hard navigate to avoid any potential state leakage
    window.location.href = '/';
  }

  return <ChefAuthContext.Provider value={{ state, setAccessCode }}>{children}</ChefAuthContext.Provider>;
};
