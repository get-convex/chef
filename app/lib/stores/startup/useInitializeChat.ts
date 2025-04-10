import { selectedTeamSlugStore, waitForSelectedTeamSlug } from '~/lib/stores/convexTeams';

import { useConvex } from 'convex/react';
import { waitForConvexSessionId } from '~/lib/stores/sessionId';
import { useAuth0 } from '@auth0/auth0-react';
import { useCallback } from 'react';
import { api } from '@convex/_generated/api';
import { useChefAuth } from '~/components/chat/ChefAuthWrapper';
import { toast } from 'sonner';

const SIGNIN_WINDOW_WIDTH = 400;
const SIGNIN_WINDOW_HEIGHT = 600;

export function useInitializeChat(chatId: string) {
  const { getAccessTokenSilently } = useAuth0();
  const convex = useConvex();
  const chefAuthState = useChefAuth();
  const isFullyLoggedIn = chefAuthState.kind === 'fullyLoggedIn';
  return useCallback(async () => {
    // Note: for existing chats, we redirect to the homepage if the user is unauthenticated
    if (!isFullyLoggedIn) {
      const left = window.innerWidth / 2 - SIGNIN_WINDOW_WIDTH / 2;
      const top = window.innerHeight / 2 - SIGNIN_WINDOW_HEIGHT / 2;
      toast.info('Please sign in first to continue!');
      window.open(
        '/signin',
        'SignIn',
        `width=${SIGNIN_WINDOW_WIDTH},height=${SIGNIN_WINDOW_HEIGHT},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
      );
    }
    const sessionId = await waitForConvexSessionId('useInitializeChat');
    const selectedTeamSlug = selectedTeamSlugStore.get();
    if (selectedTeamSlug === null) {
      toast.info('Please select a team first!');
    }
    const teamSlug = await waitForSelectedTeamSlug('useInitializeChat');
    const response = await getAccessTokenSilently({ detailedResponse: true });
    const projectInitParams = {
      teamSlug,
      auth0AccessToken: response.id_token,
    };
    await convex.mutation(api.messages.initializeChat, {
      id: chatId,
      sessionId,
      projectInitParams,
    });
  }, [convex, chatId, getAccessTokenSilently, isFullyLoggedIn]);
}
