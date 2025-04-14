import { useCallback, useEffect, useState } from 'react';
import { useChefAuthContext } from './chat/ChefAuthWrapper';
import { Loading } from './Loading';
import { useAuth0 } from '@auth0/auth0-react';
import { toast } from 'sonner';
import { Link } from '@remix-run/react';
import { classNames } from '~/utils/classNames';
import { getConvexAuthToken } from '~/lib/stores/sessionId';
import { useConvex, useConvexAuth } from 'convex/react';
import { fetchOptIns } from '~/lib/convexOptins';
export const ChefSignInPage = () => {
  const chefAuth = useChefAuthContext();

  switch (chefAuth.state.kind) {
    case 'loading':
      return <Loading />;
    case 'unauthenticated':
      return <ConvexSignInForm />;
    case 'fullyLoggedIn':
      return <OptInsScreen />;
    default:
      return <div>Unknown state</div>;
  }
};

function ConvexSignInForm() {
  const { loginWithRedirect } = useAuth0();
  const [started, setStarted] = useState(false);
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <h1 className="text-2xl font-bold">Connect to Convex</h1>
      <button
        className="px-4 py-2 rounded-lg border-1 border-bolt-elements-borderColor flex items-center gap-2 text-bolt-elements-button-primary disabled:opacity-50 disabled:cursor-not-allowed bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover"
        onClick={() => {
          if (!started) {
            setStarted(true);
            loginWithRedirect({
              authorizationParams: {
                connection: 'github',
                redirect_uri: `${window.location.origin}/signin`,
              },
            });
          }
        }}
        disabled={started}
      >
        <img className="w-4 h-4" height="16" width="16" src="/icons/Convex.svg" alt="Convex" />
        Log in with your Convex account
      </button>
    </div>
  );
}

const VITE_PROVISION_HOST = import.meta.env.VITE_PROVISION_HOST || 'https://api.convex.dev';

type OptInToAccept = {
  optIn: {
    tos: string;
  };
  message: string;
};

function OptInsScreen() {
  const convex = useConvex();
  const { isAuthenticated } = useConvexAuth();
  const [optIns, setOptIns] = useState<
    | {
        kind: 'loading';
      }
    | {
        kind: 'loaded';
        optIns: OptInToAccept[];
      }
    | {
        kind: 'error';
        error: string;
      }
  >({
    kind: 'loading',
  });
  const [isChecked, setIsChecked] = useState(false);
  useEffect(() => {
    if (!isAuthenticated) {
      // We can't fetch the opt ins if the user is not authenticated
      return;
    }
    fetchOptIns(convex).then((result) => {
      switch (result.kind) {
        case 'loaded':
          setOptIns({
            kind: 'loaded',
            optIns: result.optIns,
          });
          break;
        case 'error':
          setOptIns({
            kind: 'error',
            error: result.error,
          });
          break;
        case 'missingAuth':
          // Do nothing, stay loading
          break;
      }
    });
  }, [isAuthenticated, convex]);

  const acceptOptIns = useCallback(
    async (optInsToAccept: OptInToAccept[]) => {
      const token = getConvexAuthToken(convex);
      if (!token) {
        toast.error('Unexpected error accepting opt ins.');
        return;
      }
      const response = await fetch(`${VITE_PROVISION_HOST}/api/dashboard/optins`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(optInsToAccept.map((optIn) => optIn.optIn)),
      });
      if (!response.ok) {
        toast.error(`Failed to accept opt ins: ${response.statusText}`);
      } else {
        setOptIns({
          kind: 'loaded',
          optIns: [],
        });
      }
    },
    [convex],
  );

  if (optIns.kind === 'loading') {
    return <Loading />;
  }
  if (optIns.kind === 'error') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center">
        <div className="text-2xl font-bold">Finish signing up for Convex on the dashboard!</div>
        <div className="text-sm text-bolt-elements-textSecondary">
          Go to the{' '}
          <Link
            className="text-bolt-elements-button-primary underline"
            to="https://dashboard.convex.dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            dashboard
          </Link>{' '}
          and finish signing up for Convex before you can use Chef.
        </div>
      </div>
    );
  }

  if (optIns.kind === 'loaded' && optIns.optIns.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center">
        <div className="text-2xl font-bold">Done logging in!</div>
        <div className="text-sm text-bolt-elements-textSecondary">
          You can now close this window and return to your project.
        </div>
      </div>
    );
  }
  if (optIns.kind === 'loaded') {
    // Note: As of 2025-04-11, we have a single opt in type, so we're hardcoding the UI for that.
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-md text-content-primary text-center">
          Welcome to Convex! We need you to take a look at these before we continue.
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={isChecked} onChange={(e) => setIsChecked(e.target.checked)} />
          <div className="text-sm text-content-primary">
            <span>
              I've read and accept the{' '}
              <a
                href="https://www.convex.dev/legal/tos"
                target="_blank"
                rel="noopener noreferrer"
                className="text-bolt-elements-button-primary underline"
              >
                Terms of Service
              </a>
              .
            </span>
          </div>
        </div>
        <button
          className={classNames(
            'flex items-center gap-2 p-1.5 rounded-md text-left text-bolt-elements-textPrimary bg-bolt-elements-button-primary',
            'hover:bg-bolt-elements-button-primaryHover',
            !isChecked ? 'opacity-50 cursor-not-allowed' : '',
          )}
          disabled={!isChecked}
          onClick={() => acceptOptIns(optIns.optIns)}
        >
          Continue
        </button>
      </div>
    );
  }
}

const SIGNIN_WINDOW_WIDTH = 400;
const SIGNIN_WINDOW_HEIGHT = 600;
export function openSignInWindow() {
  const left = window.innerWidth / 2 - SIGNIN_WINDOW_WIDTH / 2;
  const top = window.innerHeight / 2 - SIGNIN_WINDOW_HEIGHT / 2;
  window.open(
    '/signin',
    'SignIn',
    `width=${SIGNIN_WINDOW_WIDTH},height=${SIGNIN_WINDOW_HEIGHT},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
  );
}
