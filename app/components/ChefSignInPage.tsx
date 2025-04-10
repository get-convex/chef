import { useEffect } from 'react';
import { useChefAuthContext } from './chat/ChefAuthWrapper';
import { Loading } from './Loading';
import { useAuth0 } from '@auth0/auth0-react';

export const ChefSignInPage = () => {
  const chefAuth = useChefAuthContext();

  useEffect(() => {
    if (chefAuth.state.kind === 'fullyLoggedIn') {
      window.close();
    }
  }, [chefAuth.state.kind]);

  switch (chefAuth.state.kind) {
    case 'loading':
      return <Loading />;
    case 'unauthenticated':
      return <ConvexSignInForm />;
    case 'fullyLoggedIn':
      return (
        <div className="h-full w-full flex flex-col items-center justify-center">
          <div className="text-2xl font-bold">Done logging in!</div>
          <div className="text-sm text-bolt-elements-textSecondary">
            You can now close this window and return to your project.
          </div>
        </div>
      );
    default:
      return <div>Unknown state</div>;
  }
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
