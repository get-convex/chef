import { useAuth0 } from '@auth0/auth0-react';
import type { Id } from '@convex/_generated/dataModel';
import { json } from '@vercel/remix';
import type { LoaderFunctionArgs } from '@vercel/remix';
import type { MetaFunction } from '@vercel/remix';
import { useConvex } from 'convex/react';
import { useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { toast } from 'sonner';
import { ChefAuthProvider, useChefAuthContext } from '~/components/chat/ChefAuthWrapper';
import { Header } from '~/components/header/Header';
import { Loading } from '~/components/Loading';
import { validateAccessCode } from '~/lib/stores/convex';
import { classNames } from '~/utils/classNames';

export const meta: MetaFunction = () => {
  return [
    { title: 'Chef - Sign In' },
    { name: 'description', content: 'Sign in to Chef, the full-stack AI coding agent from Convex' },
  ];
};

export const loader = async (args: LoaderFunctionArgs) => {
  const url = new URL(args.request.url);
  let code: string | null = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  // If state is also set, this is probably the GitHub OAuth login flow finishing.
  // The code is probably not for us.
  if (state) {
    code = null;
  }
  return json({ code });
};

// Home page that asks the user to login and provide an initial prompt. After
// starting the chat, all of the globals' in-memory state is preserved as it
// switches to the chat view (we do *not* do a full page reload and go to the
// chat route). This route is optimized for making the initial experience
// really seamless.
//
// It's critical that going back to the homepage or to other chats use a `<a>`
// tag so all in-memory state is rebuilt from scratch.
export default function Index() {
  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <Header />
      <ClientOnly>
        {() => (
          <>
            <ChefAuthProvider redirectIfUnauthenticated={false}>
              <SignInPage />
            </ChefAuthProvider>
          </>
        )}
      </ClientOnly>
    </div>
  );
}

const SignInPage = () => {
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
