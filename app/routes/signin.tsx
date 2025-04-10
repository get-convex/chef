import { json } from '@vercel/remix';
import type { LoaderFunctionArgs } from '@vercel/remix';
import type { MetaFunction } from '@vercel/remix';
import { ClientOnly } from 'remix-utils/client-only';
import { ChefAuthProvider, ConvexSignInForm, useChefAuth } from '~/components/chat/ChefAuthWrapper';
import { Header } from '~/components/header/Header';
import { Loading } from '~/components/Loading';

export const meta: MetaFunction = () => {
  return [
    { title: 'Chef' },
    { name: 'description', content: 'Cook up something hot with Chef, the full-stack AI coding agent from Convex' },
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
            <ChefAuthProvider>
              <Modal />
            </ChefAuthProvider>
          </>
        )}
      </ClientOnly>
    </div>
  );
}

const Modal = () => {
  const { state: chefAuthState } = useChefAuth();
  switch (chefAuthState.kind) {
    case 'loading':
      return <Loading />;
    case 'unauthenticated':
      return <ConvexSignInForm />;
    case 'fullyLoggedIn':
      return (
        <div className="h-full w-full flex flex-col items-center justify-center">
          <div className="text-2xl font-bold">Done logging in!</div>
          <div className="text-sm text-gray-500">You can now close this window and return to your chat.</div>
        </div>
      );
    default:
      return <div>Unknown state</div>;
  }
};
