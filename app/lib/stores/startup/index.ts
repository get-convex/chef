import { useStoreMessageHistory } from './useStoreMessageHistory';
import { useExistingInitializeChat, useHomepageInitializeChat } from './useInitializeChat';
import { useInitialMessages } from './useInitialMessages';
import { useProjectInitializer } from './useProjectInitializer';
import { useTeamsInitializer } from './useTeamsInitializer';
import { useExistingChatContainerSetup, useNewChatContainerSetup } from './useContainerSetup';
import { useBackupSyncState } from './history';
import { useState } from 'react';
import { useConvexSessionIdOrNullOrLoading } from '../sessionId';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';

export function useConvexChatHomepage(chatId: string) {
  console.log('useConvexChatHomepage', chatId);
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

  console.log('subchats in homepage', subchats);
  console.log('initial meesages in homepage', initialMessages);

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
  console.log('subchats in existing', initialMessages?.subchats);
  return {
    initialMessages: !initialMessages ? initialMessages : initialMessages?.deserialized,
    initializeChat,
    storeMessageHistory,
    subchats: initialMessages?.subchats,
  };
}
