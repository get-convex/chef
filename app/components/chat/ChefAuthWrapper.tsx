import { useAuth0 } from '@auth0/auth0-react';
import { useConvex } from 'convex/react';

import { useConvexAuth } from 'convex/react';
import { useEffect } from 'react';

import { sessionIdStore, setInitialConvexSessionId } from '~/lib/stores/sessionId';

import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import { Loading } from '~/components/Loading';

export function ChefAuthWrapper({ children }: { children: React.ReactNode }) {
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const convex = useConvex();
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();

  useEffect(() => {
    if (sessionId === undefined) {
      const isUnauthenticated = !isAuthenticated && !isConvexAuthLoading;
      if (isUnauthenticated) {
        sessionIdStore.set(null);
      } else if (isAuthenticated) {
        setInitialConvexSessionId(convex);
      }
    }
  }, [sessionId, isAuthenticated, isConvexAuthLoading]);

  const isLoading = sessionId === undefined || isConvexAuthLoading;

  if (isLoading) {
    return <Loading />;
  }

  const isUnauthenticated = sessionId === null || !isAuthenticated;

  if (isUnauthenticated) {
    return <ConvexSignInForm />;
  }

  return sessionId === null ? <ConvexSignInForm /> : children;
}

function ConvexSignInForm() {
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
