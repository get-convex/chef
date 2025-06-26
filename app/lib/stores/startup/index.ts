import { useStoreMessageHistory } from './useStoreMessageHistory';
import { useExistingInitializeChat, useHomepageInitializeChat } from './useInitializeChat';
import { useInitialMessages } from './useInitialMessages';
import { useProjectInitializer } from './useProjectInitializer';
import { useTeamsInitializer } from './useTeamsInitializer';
import { useExistingChatContainerSetup, useNewChatContainerSetup } from './useContainerSetup';
import { useBackupSyncState } from './history';
import { useState } from 'react';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';

export function useConvexChatHomepage(chatId: string) {
  useTeamsInitializer();
  useProjectInitializer(chatId);
  const [chatInitialized, setChatInitialized] = useState(false);
  const initializeChat = useHomepageInitializeChat(chatId, setChatInitialized);
  useBackupSyncState(chatId, []);
  const storeMessageHistory = useStoreMessageHistory();
  useNewChatContainerSetup();
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const initialMessages = useInitialMessages(chatInitialized ? chatId : undefined);
  const subchats = useQuery(
    api.subchats.get,
    !!sessionId && chatInitialized
      ? {
          chatId,
          sessionId,
        }
      : 'skip',
  );

  return {
    initializeChat,
    storeMessageHistory,
    subchats,
    initialMessages: !initialMessages ? initialMessages : initialMessages?.deserialized,
  };
}

export function useConvexChatExisting(chatId: string) {
  useTeamsInitializer();
  useProjectInitializer(chatId);
  const initializeChat = useExistingInitializeChat(chatId);
  const initialMessages = useInitialMessages(chatId);
  useBackupSyncState(chatId, initialMessages?.deserialized);
  const storeMessageHistory = useStoreMessageHistory();
  useExistingChatContainerSetup(initialMessages?.loadedChatId);
  return {
    initialMessages: !initialMessages ? initialMessages : initialMessages?.deserialized,
    initializeChat,
    storeMessageHistory,
    subchats: initialMessages?.subchats,
  };
}
