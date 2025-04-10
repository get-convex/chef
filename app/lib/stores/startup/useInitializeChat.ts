import { selectedTeamSlugStore, waitForSelectedTeamSlug } from '~/lib/stores/convexTeams';

import { useConvex } from 'convex/react';
import { getConvexAuthToken, waitForConvexSessionId } from '~/lib/stores/sessionId';
import { useCallback } from 'react';
import { api } from '@convex/_generated/api';
import { useChefAuth } from '~/components/chat/ChefAuthWrapper';
import { toast } from 'sonner';
import { openSignInWindow } from '~/components/ChefSignInPage';
import { ContainerBootState, waitForBootStepCompleted } from '~/lib/stores/containerBootState';

export function useHomepageInitializeChat(chatId: string) {
  const convex = useConvex();
  const chefAuthState = useChefAuth();
  const isFullyLoggedIn = chefAuthState.kind === 'fullyLoggedIn';
  return useCallback(async () => {
    if (!isFullyLoggedIn) {
      toast.info('Please sign in first to continue!');
      openSignInWindow();
    }
    const sessionId = await waitForConvexSessionId('useInitializeChat');
    const selectedTeamSlug = selectedTeamSlugStore.get();
    if (selectedTeamSlug === null) {
      toast.info('Please select a team first!');
    }

    const auth0AccessToken = getConvexAuthToken(convex);
    if (!auth0AccessToken) {
      console.error('No auth0 access token');
      toast.error('Unexpected error creating chat');
      return;
    }
    const teamSlug = await waitForSelectedTeamSlug('useInitializeChat');

    const projectInitParams = {
      teamSlug,
      auth0AccessToken,
    };
    await convex.mutation(api.messages.initializeChat, {
      id: chatId,
      sessionId,
      projectInitParams,
    });

    // Wait for the WebContainer to have its snapshot loaded before sending a message.
    await waitForBootStepCompleted(ContainerBootState.LOADING_SNAPSHOT);
  }, [convex, chatId, isFullyLoggedIn]);
}

export function useExistingInitializeChat(chatId: string) {
  const convex = useConvex();
  const chefAuthState = useChefAuth();
  const isFullyLoggedIn = chefAuthState.kind === 'fullyLoggedIn';
  return useCallback(async () => {
    const sessionId = await waitForConvexSessionId('useInitializeChat');
    const teamSlug = await waitForSelectedTeamSlug('useInitializeChat');
    const auth0AccessToken = getConvexAuthToken(convex);
    if (!auth0AccessToken) {
      console.error('No auth0 access token');
      toast.error('Unexpected error creating chat');
      return;
    }
    const projectInitParams = {
      teamSlug,
      auth0AccessToken,
    };
    await convex.mutation(api.messages.initializeChat, {
      id: chatId,
      sessionId,
      projectInitParams,
    });

    // We don't need to wait for container boot here since we don't mount
    // the UI until it's fully ready.
  }, [convex, chatId, isFullyLoggedIn]);
}
