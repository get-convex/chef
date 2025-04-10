import { useStore } from '@nanostores/react';
import { sessionIdStore, waitForConvexSessionId } from '~/lib/stores/sessionId';
import { json } from '@vercel/remix';
import type { LoaderFunctionArgs } from '@vercel/remix';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useCallback } from 'react';
import { Toaster } from 'sonner';
import { waitForSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { useAuth0 } from '@auth0/auth0-react';
import { TeamSelector } from '~/components/convex/TeamSelector';
import { useTeamsInitializer } from '~/lib/stores/startup/useTeamsInitializer';
import { ChefAuthProvider, useChefAuth } from '~/components/chat/ChefAuthWrapper';
import { useParams } from '@remix-run/react';
import { openSignInWindow } from '~/components/ChefSignInPage';
import { Loading } from '~/components/Loading';

export const loader = async (args: LoaderFunctionArgs) => {
  const url = new URL(args.request.url);
  let code: string | null = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (state) {
    code = null;
  }
  return json({ code });
};

export default function ShareProject() {
  return (
    <>
      <ChefAuthProvider redirectIfUnauthenticated={false}>
        <ShareProjectContent />
      </ChefAuthProvider>
      <Toaster position="bottom-right" closeButton richColors />
    </>
  );
}

function ShareProjectContent() {
  const { shareCode } = useParams();

  if (!shareCode) {
    throw new Error('shareCode is required');
  }

  useTeamsInitializer();
  const chefAuthState = useChefAuth();

  const sessionId = useStore(sessionIdStore);
  const cloneChat = useMutation(api.share.clone);
  const { getAccessTokenSilently } = useAuth0();
  const handleCloneChat = useCallback(async () => {
    const sessionId = await waitForConvexSessionId('useInitializeChat');
    const teamSlug = await waitForSelectedTeamSlug('useInitializeChat');
    const response = await getAccessTokenSilently({ detailedResponse: true });
    const projectInitParams = {
      teamSlug,
      auth0AccessToken: response.id_token,
    };
    const { id: chatId } = await cloneChat({ shareCode, sessionId, projectInitParams });
    window.location.href = `/chat/${chatId}`;
  }, [sessionId, getAccessTokenSilently]);
  const signIn = useCallback(() => {
    openSignInWindow();
  }, []);

  if (chefAuthState.kind === 'loading') {
    return <Loading />;
  }

  if (chefAuthState.kind !== 'fullyLoggedIn') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full space-y-4">
          <h1 className="text-2xl font-bold text-center">Sign in to Chef</h1>
          <p className="text-sm text-center text-gray-500">Please sign in to Chef to clone this project.</p>
          <button
            className="mx-auto px-4 py-2 rounded-lg border-1 border-bolt-elements-borderColor flex items-center gap-2 text-bolt-elements-button-primary disabled:opacity-50 disabled:cursor-not-allowed bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover"
            onClick={signIn}
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="max-w-md w-full space-y-4">
        <h1 className="text-2xl font-bold text-center">Select a Team</h1>
        <p className="text-sm text-center text-gray-500">Choose the team where you want to clone this project</p>
        {chefAuthState.kind === 'fullyLoggedIn' && <TeamSelector />}
        <button
          className="mx-auto px-4 py-2 rounded-lg border-1 border-bolt-elements-borderColor flex items-center gap-2 text-bolt-elements-button-primary disabled:opacity-50 disabled:cursor-not-allowed bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover"
          onClick={handleCloneChat}
        >
          Clone
        </button>
      </div>
    </div>
  );
}
