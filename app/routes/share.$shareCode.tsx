import { useStore } from '@nanostores/react';
import { getConvexAuthToken, sessionIdStore, waitForConvexSessionId } from '~/lib/stores/sessionId';
import { json } from '@vercel/remix';
import type { LoaderFunctionArgs } from '@vercel/remix';
import { useMutation, useConvex, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { Toaster } from '~/components/ui/Toaster';
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
      <Toaster />
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
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 rounded-xl border border-bolt-elements-borderColor bg-white p-8">
          <div className="space-y-2 text-center">
            <h1 className="text-center text-3xl font-bold">Sign in to Chef</h1>
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
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-button-secondary-background px-6 py-3 text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-secondary-backgroundHover disabled:cursor-not-allowed disabled:opacity-50"
            onClick={signIn}
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-bolt-elements-borderColor bg-white p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-center text-3xl font-bold">Clone Project</h1>
          {getShareDescription?.description && (
            <p className="text-base text-gray-500">{getShareDescription.description}</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-center text-lg font-semibold">Select Team</h2>
            <p className="text-center text-sm text-gray-500">Choose where to clone this project</p>
          </div>

          {chefAuthState.kind === 'fullyLoggedIn' && (
            <div className="rounded-lg border border-bolt-elements-borderColor p-4">
              <TeamSelector selectedTeamSlug={selectedTeamSlug} setSelectedTeamSlug={setSelectedTeamSlug} />
            </div>
          )}
        </div>

        <button
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-button-secondary-background px-6 py-3 text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-secondary-backgroundHover disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleCloneChat}
          disabled={!selectedTeamSlug}
        >
          Clone Project
        </button>
      </div>
    </div>
  );
}
