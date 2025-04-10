import { useNavigate, useParams } from '@remix-run/react';
import { useStore } from '@nanostores/react';
import { sessionIdStore, waitForConvexSessionId } from '~/lib/stores/sessionId';
import type { Id } from '@convex/_generated/dataModel';
import { json } from '@vercel/remix';
import type { LoaderFunctionArgs } from '@vercel/remix';
import { getFlexAuthModeInLoader } from '~/lib/persistence/convex';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useEffect } from 'react';
import { FlexAuthWrapper } from '~/components/chat/FlexAuthWrapper';
import { Toaster } from 'sonner';
import { waitForSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { flexAuthModeStore } from '~/lib/stores/convex';
import { useAuth0 } from '@auth0/auth0-react';
import { TeamSelector } from '~/components/convex/TeamSelector';
import { useTeamsInitializer } from '~/lib/stores/startup/useTeamsInitializer';

export const loader = async (args: LoaderFunctionArgs) => {
  const url = new URL(args.request.url);
  let code: string | null = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  // If state is also set, this is probably the GitHub OAuth login flow finishing.
  // The code is probably not for us.
  if (state) {
    code = null;
  }
  const flexAuthMode = getFlexAuthModeInLoader();
  return json({ code, flexAuthMode });
};

export default function ShareProject() {
  // const { initialMessages, storeMessageHistory, initializeChat } = useConvexChatExisting(chatId);

  return (
    <>
      <FlexAuthWrapper>
        <ShareProjectContent />
      </FlexAuthWrapper>
      <Toaster position="bottom-right" closeButton richColors />
    </>
  );
}

function ShareProjectContent() {
  const { shareId } = useParams();
  const navigate = useNavigate();

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
      const flexAuthMode = flexAuthModeStore.get();
      if (flexAuthMode !== 'ConvexOAuth') {
        throw new Error('Flex auth mode is not ConvexOAuth');
      }
      const response = await getAccessTokenSilently({ detailedResponse: true });
      const projectInitParams = {
        teamSlug,
        auth0AccessToken: response.id_token,
      };
      const { id: chatId } = await cloneChat({ id: shareId as Id<'shares'>, sessionId, projectInitParams });
      console.log('chatId', chatId);
      navigate(`/chat/${chatId}`);
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
