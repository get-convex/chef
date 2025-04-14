import { useStore } from '@nanostores/react';
import { getConvexAuthToken, sessionIdStore, waitForConvexSessionId } from '~/lib/stores/sessionId';
import { json } from '@vercel/remix';
import type { LoaderFunctionArgs } from '@vercel/remix';
import { useMutation, useConvex, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import { setSelectedTeamSlug, useSelectedTeamSlug, waitForSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { TeamSelector } from '~/components/convex/TeamSelector';
import { useTeamsInitializer } from '~/lib/stores/startup/useTeamsInitializer';
import { ChefAuthProvider, useChefAuth } from '~/components/chat/ChefAuthWrapper';
import { useParams } from '@remix-run/react';
import { openSignInWindow } from '~/components/ChefSignInPage';
import { Loading } from '~/components/Loading';
import type { MetaFunction } from '@vercel/remix';

export const meta: MetaFunction = () => {
  return [
    { title: 'Cooked with Chef' },
    {
      name: 'description',
      content: 'Someone shared with you a project cooked with Chef, the full-stack AI coding agent from Convex',
    },
    {
      property: 'og:image',
      content: '/social_preview_share.jpg',
    },
  ];
};

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
  const convex = useConvex();
  const getShareDescription = useQuery(api.share.getShareDescription, { code: shareCode });

  const handleCloneChat = useCallback(async () => {
    const sessionId = await waitForConvexSessionId('useInitializeChat');
    const teamSlug = await waitForSelectedTeamSlug('useInitializeChat');
    const auth0AccessToken = getConvexAuthToken(convex);
    if (!auth0AccessToken) {
      console.error('No auth0 access token');
      toast.error('Unexpected error cloning chat');
      return;
    }
    const projectInitParams = {
      teamSlug,
      auth0AccessToken,
    };
    const { id: chatId } = await cloneChat({ shareCode, sessionId, projectInitParams });
    window.location.href = `/chat/${chatId}`;
  }, [sessionId, convex]);
  const signIn = useCallback(() => {
    openSignInWindow();
  }, []);

  const selectedTeamSlug = useSelectedTeamSlug();

  if (chefAuthState.kind === 'loading') {
    return <Loading />;
  }

  if (chefAuthState.kind !== 'fullyLoggedIn') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full space-y-6 bg-white rounded-xl border border-bolt-elements-borderColor p-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-center">Sign in to Chef</h1>
            <p className="text-base text-gray-500">
              Please sign in to Chef to clone this project
              {getShareDescription?.description ? (
                <>
                  : <span className="font-bold">{getShareDescription.description}</span>
                </>
              ) : (
                ''
              )}
            </p>
          </div>

          <button
            className="w-full px-6 py-3 rounded-lg border border-bolt-elements-borderColor flex items-center justify-center gap-2 text-bolt-elements-button-primary-text disabled:opacity-50 disabled:cursor-not-allowed bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover"
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
      <div className="max-w-md w-full space-y-6 bg-white rounded-xl border border-bolt-elements-borderColor p-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-center">Clone Project</h1>
          {getShareDescription?.description && (
            <p className="text-base text-gray-500">{getShareDescription.description}</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-center">Select Team</h2>
            <p className="text-sm text-center text-gray-500">Choose where to clone this project</p>
          </div>

          {chefAuthState.kind === 'fullyLoggedIn' && (
            <div className="border border-bolt-elements-borderColor rounded-lg p-4">
              <TeamSelector selectedTeamSlug={selectedTeamSlug} setSelectedTeamSlug={setSelectedTeamSlug} />
            </div>
          )}
        </div>

        <button
          className="w-full px-6 py-3 rounded-lg border border-bolt-elements-borderColor flex items-center justify-center gap-2 text-bolt-elements-button-primary-text disabled:opacity-50 disabled:cursor-not-allowed bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover"
          onClick={handleCloneChat}
          disabled={!selectedTeamSlug}
        >
          Clone Project
        </button>
      </div>
    </div>
  );
}
