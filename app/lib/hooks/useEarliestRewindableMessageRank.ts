import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import { chatIdStore } from '~/lib/stores/chatId';
import type { Id } from '@convex/_generated/dataModel';

export function useEarliestRewindableMessageRank(subchatIndex: number = 0): number | null | undefined {
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const chatId = chatIdStore.get();

  return useQuery(
    api.messages.earliestRewindableMessageRank,
    sessionId && chatId
      ? {
          sessionId: sessionId as Id<'sessions'>,
          chatId,
          subchatIndex,
        }
      : 'skip',
  );
}
