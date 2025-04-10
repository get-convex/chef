import { useChefAuthContext } from './chat/ChefAuthWrapper';
import { Loading } from './Loading';
import { useAuth0 } from '@auth0/auth0-react';
import { useState } from 'react';
import { useConvex } from 'convex/react';
import { validateAccessCode } from '~/lib/stores/convex';
import { toast } from 'sonner';
import { classNames } from '~/utils/classNames';
import type { Id } from '@convex/_generated/dataModel';

export const ChefSignInPage = () => {
  const chefAuth = useChefAuthContext();
  switch (chefAuth.state.kind) {
    case 'loading':
      return <Loading />;
    case 'unauthenticated':
      return <ConvexSignInForm />;
    case 'needsAccessCode':
      return <AccessGateForm setAccessCode={chefAuth.setAccessCode} />;
    case 'fullyLoggedIn':
      return (
        <div className="h-full w-full flex flex-col items-center justify-center">
          <div className="text-2xl font-bold">Done logging in!</div>
          <div className="text-sm text-gray-500">You can now close this window and return to your project.</div>
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

function AccessGateForm({ setAccessCode }: { setAccessCode: (accessCode: Id<'sessions'> | null) => void }) {
  const [code, setCode] = useState<string | null>(null);
  const convex = useConvex();
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <h1 className="text-2xl font-bold text-bolt-elements-textPrimary font-display">
        Please enter an invite code to continue
      </h1>
      <form
        className="w-full max-w-md flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          validateAccessCode(convex, { code, localStorageEntry: null }).then((accessCode) => {
            if (accessCode) {
              setAccessCode(accessCode);
            } else {
              setAccessCode(null);
              toast.error('Invalid invite code');
            }
          });
        }}
      >
        <input
          type="text"
          value={code || ''}
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
