import { useConvex, useMutation, useQuery } from 'convex/react';
import { useQueries as useReactQueries } from '@tanstack/react-query';
import { api } from '@convex/_generated/api';
import type { ModelMessage } from 'ai';
import { decompressWithLz4 } from '~/lib/compression.client';
import { queryClientStore } from '~/lib/stores/reactQueryClient';
import { useEffect, useState } from 'react';
import { getConvexAuthToken } from '~/lib/stores/sessionId';

async function fetchPromptData(url: string): Promise<ModelMessage[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch prompt data: ${response.statusText}`);
  }

  const compressedData = await response.arrayBuffer();
  const decompressedData = decompressWithLz4(new Uint8Array(compressedData));
  const textDecoder = new TextDecoder();
  const jsonString = textDecoder.decode(decompressedData);
  return JSON.parse(jsonString) as ModelMessage[];
}

export function useAuthToken() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const convex = useConvex();
  useEffect(() => {
    async function grabAuthToken() {
      const token = getConvexAuthToken(convex);
      if (token !== authToken) {
        setAuthToken(token);
      }
    }
    grabAuthToken();

    // This token doesn't expire for 24 hours, but it might not be refreshed until there's just a little time left.
    const intervalId = setInterval(
      () => {
        grabAuthToken();
      },
      // If there isn't one, check again very soon! This is unusual in Chef.
      // If there is one, occasionally check for a new one to try to catch the update.
      authToken ? 10 * 60 * 1000 : 100,
    );
    return () => clearInterval(intervalId);
  }, [convex, authToken]);
  return authToken;
}

/** Also requests the convex deployment to check if the user is an admin. */
export function useIsAdmin() {
  // Get the auth token (the same one this Convex WebSocket connection is already authenticated with)
  // because we don't make it available in Convex functions.
  const authToken = useAuthToken();
  const requestAdminCheck = useMutation(api.admin.requestAdminCheck);
  const isAdmin = useQuery(api.admin.isCurrentUserAdmin, {});

  useEffect(() => {
    if (isAdmin === false && authToken) {
      requestAdminCheck({
        token: authToken,
      }).catch((error) => {
        console.error('Error requesting admin check:', error);
      });
    }
  }, [isAdmin, requestAdminCheck, authToken]);

  return !!isAdmin;
}

export function useDebugPrompt(chatInitialId: string) {
  const isAdmin = useIsAdmin();
  const promptMetadatas = useQuery(api.debugPrompt.show, isAdmin ? { chatInitialId } : 'skip');

  // Use React Query to fetch and cache the prompts for each URL forever.
  const queries = useReactQueries(
    {
      queries: (promptMetadatas || []).map((promptMetadata) => ({
        queryKey: ['prompt', promptMetadata.coreMessagesUrl],
        queryFn: () => fetchPromptData(promptMetadata.coreMessagesUrl!),
        // These data at these URLs never changes
        staleTime: Infinity,
        // If this is a dedicated debugging page where many prompts are shown this might need to change
        gcTime: 10 * 60 * 1000,
      })),
    },
    queryClientStore.get(),
  );

  // Any errors return an error.
  const firstErroredQuery = queries.find((query) => query.isError);
  if (firstErroredQuery) {
    return {
      data: null,
      isPending: false as const,
      error: firstErroredQuery.error,
    };
  }

  // If no HTTP request have completed, call that pending.
  if (promptMetadatas === undefined || (queries.length > 0 && !queries.some((query) => query.data))) {
    return {
      data: null,
      isPending: true as const,
      error: null,
    };
  }

  // Elements of this array may be missing their prompt messages.
  return {
    data: queries.map((query, i) => {
      const { responseCoreMessages, ...rest } = promptMetadatas[i];
      return {
        prompt: query.data || undefined,
        completion: responseCoreMessages,
        ...rest,
      };
    }),
    isPending: false as const,
    error: null,
  };
}
