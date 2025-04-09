import { flexAuthModeStore } from "../convex";

import { waitForSelectedTeamSlug } from '../convexTeams';

import { useConvex } from "convex/react";
import { waitForConvexSessionId } from '../sessionId';
import { useAuth0 } from "@auth0/auth0-react";
import { useCallback } from "react";
import { api } from "@convex/_generated/api";

export function useInitializeChat(chatId: string) {
    const { getAccessTokenSilently } = useAuth0();
    const convex = useConvex();
    return useCallback(async () => {
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
      await convex.mutation(api.messages.initializeChat, {
        id: chatId,
        sessionId,
        projectInitParams,
      });
    }, [convex, chatId, getAccessTokenSilently]);
  }