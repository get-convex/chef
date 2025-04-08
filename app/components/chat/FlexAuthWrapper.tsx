import { useAuth0 } from '@auth0/auth0-react';
import { useLoaderData } from '@remix-run/react';
import { useConvex } from 'convex/react';

import { useConvexAuth } from 'convex/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  sessionIdStore,
  flexAuthModeStore,
  setInitialConvexSessionId,
  setConvexSessionIdFromCode,
} from '~/lib/stores/convex';

import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/convex';
import { classNames } from '~/utils/classNames';

export function FlexAuthWrapper({ children }: { children: React.ReactNode }) {
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const convex = useConvex();
  const { code: codeFromLoader, flexAuthMode } = useLoaderData<{
    code?: string;
    flexAuthMode: 'InviteCode' | 'ConvexOAuth';
  }>();
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  useEffect(() => {
    flexAuthModeStore.set(flexAuthMode);
  }, [flexAuthMode]);

  useEffect(() => {
    if (sessionId === undefined) {
      if (flexAuthMode === 'ConvexOAuth') {
        const isUnauthenticated = !isAuthenticated && !isConvexAuthLoading;
        if (isUnauthenticated) {
          sessionIdStore.set(null);
        } else if (isAuthenticated) {
          setInitialConvexSessionId(convex, {
            codeFromLoader,
            flexAuthMode,
          });
        }
      }
      if (flexAuthMode === 'InviteCode') {
        setInitialConvexSessionId(convex, {
          codeFromLoader,
          flexAuthMode,
        });
      }
    }
  }, [sessionId, isAuthenticated, flexAuthMode, isConvexAuthLoading]);

  const isLoading = sessionId === undefined || flexAuthMode === undefined;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="i-ph:spinner-gap animate-spin" />
        Loading...
      </div>
    );
  }

  return sessionId === null ? <UnauthenticatedPrompt flexAuthMode={flexAuthMode} /> : children;
}

function UnauthenticatedPrompt({ flexAuthMode }: { flexAuthMode: 'InviteCode' | 'ConvexOAuth' }) {
  if (flexAuthMode === 'InviteCode') {
    return <InviteCodeForm />;
  }
  return <ConvexSignInForm />;
}

function InviteCodeForm() {
  const [code, setCode] = useState('');
  const convex = useConvex();
  const sessionId = useConvexSessionIdOrNullOrLoading();
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <h1 className="text-2xl font-bold text-bolt-elements-textPrimary font-display">
        Please enter an invite code to continue
      </h1>
      <form
        className="w-full max-w-md flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (sessionId !== null) {
            console.log('Session ID is already set');
            return;
          }
          setConvexSessionIdFromCode(convex, code, (error) => {
            console.error(error);
            toast.error('Error validating invite code');
          });
        }}
      >
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter your invite code"
          className={classNames(
            'grow px-3 py-2 rounded-lg text-sm',
            'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
            'border border-[#E5E5E5] dark:border-[#333333]',
            'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
            'focus:outline-none focus:ring-1 focus:ring-[var(--bolt-elements-borderColorActive)]',
            'disabled:opacity-50',
          )}
        />
        <button
          className="px-4 py-2 rounded-lg text-sm flex items-center mr-auto gap-2 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text disabled:opacity-50 disabled:cursor-not-allowed"
          type="submit"
        >
          Continue
        </button>
      </form>
    </div>
  );
}

function ConvexSignInForm() {
  const { loginWithRedirect } = useAuth0();
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <h1 className="text-2xl font-bold">Connect to Convex</h1>
      <button
        className="px-4 py-2 rounded-lg border-1 border-bolt-elements-borderColor flex items-center gap-2 text-bolt-elements-button-primary disabled:opacity-50 disabled:cursor-not-allowed bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover"
        onClick={() => {
          loginWithRedirect();
        }}
      >
        <img className="w-4 h-4" height="16" width="16" src="/icons/Convex.svg" alt="Convex" />
        Log in with your Convex account
      </button>
    </div>
  );
}
