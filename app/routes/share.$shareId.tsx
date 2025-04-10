import { useStore } from '@nanostores/react';
import { sessionIdStore, waitForConvexSessionId } from '~/lib/stores/sessionId';
import type { Id } from '@convex/_generated/dataModel';
import { json } from '@vercel/remix';
import type { LoaderFunctionArgs } from '@vercel/remix';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { waitForSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { useAuth0 } from '@auth0/auth0-react';
import { TeamSelector } from '~/components/convex/TeamSelector';
import { useTeamsInitializer } from '~/lib/stores/startup/useTeamsInitializer';
import { ChefAuthWrapper } from '~/components/chat/ChefAuthWrapper';
import { useParams } from '@remix-run/react';

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
      <ChefAuthWrapper>
        <ShareProjectContent />
      </ChefAuthWrapper>
      <Toaster position="bottom-right" closeButton richColors />
    </>
  );
}

function ShareProjectContent() {
  const { shareId } = useParams();

  if (!shareId) {
    throw new Error('shareId is required');
  }

  useTeamsInitializer();

  const sessionId = useStore(sessionIdStore);
  const cloneChat = useMutation(api.messages.clone);
  const { getAccessTokenSilently } = useAuth0();
  useEffect(() => {
    const f = async () => {
      const sessionId = await waitForConvexSessionId('useInitializeChat');
      const teamSlug = await waitForSelectedTeamSlug('useInitializeChat');
      const response = await getAccessTokenSilently({ detailedResponse: true });
      const projectInitParams = {
        teamSlug,
        auth0AccessToken: response.id_token,
      };
      const { id: chatId } = await cloneChat({ id: shareId as Id<'shares'>, sessionId, projectInitParams });
      window.location.href = `/chat/${chatId}`;
    };
    f();
  }, [sessionId, getAccessTokenSilently]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="max-w-md w-full space-y-4">
        <h1 className="text-2xl font-bold text-center">Select a Team</h1>
        <p className="text-sm text-center text-gray-500">Choose the team where you want to clone this project</p>
        <TeamSelector />
      </div>
    </div>
  );
}
