import { useAuth0 } from '@auth0/auth0-react';
import { useConvex } from 'convex/react';

import { useConvexAuth } from 'convex/react';
import { createContext, useContext, useEffect } from 'react';

import { sessionIdStore } from '~/lib/stores/sessionId';

import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import type { Id } from '@convex/_generated/dataModel';
import { useLocalStorage } from '@uidotdev/usehooks';
import { SESSION_ID_KEY } from '~/lib/stores/sessionId';
import { api } from '@convex/_generated/api';

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
}>({
  state: {
    kind: 'loading',
  },
});

export function useChefAuth() {
  return useContext(ChefAuthContext);
}

export const ChefAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const convex = useConvex();
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const [sessionIdFromLocalStorage, setSessionIdFromLocalStorage] = useLocalStorage<Id<'sessions'> | null>(
    SESSION_ID_KEY,
    null,
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

  const isLoading = sessionId === undefined || isConvexAuthLoading;
  const isUnauthenticated = sessionId === null || !isAuthenticated;
  const state: ChefAuthState = isLoading
    ? { kind: 'loading' }
    : isUnauthenticated
      ? { kind: 'unauthenticated' }
      : { kind: 'fullyLoggedIn', sessionId: sessionId as Id<'sessions'> };

  return <ChefAuthContext.Provider value={{ state }}>{children}</ChefAuthContext.Provider>;
};

export function ConvexSignInForm() {
  const { loginWithRedirect } = useAuth0();
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <h1 className="text-2xl font-bold">Connect to Convex</h1>
      <button
        className="px-4 py-2 rounded-lg border-1 border-bolt-elements-borderColor flex items-center gap-2 text-bolt-elements-button-primary disabled:opacity-50 disabled:cursor-not-allowed bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover"
        onClick={() => {
          loginWithRedirect({
            authorizationParams: {
              connection: 'github',
              redirect_uri: `${window.location.origin}/signin`,
            },
          });
        }}
      >
        <img className="w-4 h-4" height="16" width="16" src="/icons/Convex.svg" alt="Convex" />
        Log in with your Convex account
      </button>
    </div>
  );
}
