import { selectedTeamSlugStore, waitForSelectedTeamSlug } from '~/lib/stores/convexTeams';

import { useConvex } from 'convex/react';
import { getConvexAuthToken, waitForConvexSessionId } from '~/lib/stores/sessionId';
import { useCallback } from 'react';
import { api } from '@convex/_generated/api';
import { useChefAuth } from '~/components/chat/ChefAuthWrapper';
import { openSignInWindow } from '~/components/ChefSignInPage';
import { ContainerBootState, waitForBootStepCompleted } from '~/lib/stores/containerBootState';
import { toast } from 'sonner';

// Helper function to wait for project connection to complete
async function waitForConvexProjectConnection(
  convex: any,
  sessionId: string,
  chatId: string,
  maxWaitTime: number = 30000, // 30 seconds
): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 1000; // 1 second

  while (Date.now() - startTime < maxWaitTime) {
    const projectStatus = await convex.query(api.convexProjects.loadConnectedConvexProjectCredentials, {
      sessionId,
      chatId,
    });

    if (projectStatus?.kind === 'connected') {
      return true;
    }

    if (projectStatus?.kind === 'failed') {
      throw new Error(`Project connection failed: ${projectStatus.errorMessage}`);
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('Timeout waiting for project connection');
}

export function useHomepageInitializeChat(chatId: string, setChatInitialized: (chatInitialized: boolean) => void) {
  const convex = useConvex();
  const chefAuthState = useChefAuth();
  const isFullyLoggedIn = chefAuthState.kind === 'fullyLoggedIn';
  return useCallback(async () => {
    if (!isFullyLoggedIn) {
      openSignInWindow();
      return;
    }
    const sessionId = await waitForConvexSessionId('useInitializeChat');
    const selectedTeamSlug = selectedTeamSlugStore.get();
    if (selectedTeamSlug === null) {
      // If the user hasn't selected a team, don't initialize the chat.
      return;
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

    // Initialize the chat and start project creation
    await convex.mutation(api.messages.initializeChat, {
      id: chatId,
      sessionId,
      projectInitParams,
    });

    try {
      // Wait for the Convex project to be successfully created before allowing chat to start
      await waitForConvexProjectConnection(convex, sessionId, chatId);
      setChatInitialized(true);
    } catch (error) {
      console.error('Failed to create Convex project:', error);
      toast.error('Failed to create Convex project. Please try again.');
      return;
    }

    // Wait for the WebContainer to have its snapshot loaded before sending a message.
    await waitForBootStepCompleted(ContainerBootState.LOADING_SNAPSHOT);
  }, [convex, chatId, isFullyLoggedIn, setChatInitialized]);
}

export function useExistingInitializeChat(chatId: string) {
  const convex = useConvex();
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
  }, [convex, chatId]);
}
