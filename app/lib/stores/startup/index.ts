import { useStoreMessageHistory } from './useStoreMessageHistory';
import { useExistingInitializeChat, useHomepageInitializeChat } from './useInitializeChat';
import { useInitialMessages } from './useInitialMessages';
import { useProjectInitializer } from './useProjectInitializer';
import { useTeamsInitializer } from './useTeamsInitializer';
import { useExistingChatContainerSetup, useNewChatContainerSetup } from './useContainerSetup';
import { useBackupSyncState } from './history';
import { useState } from 'react';

export function useConvexChatHomepage(chatId: string) {
  useTeamsInitializer();
  useProjectInitializer(chatId);
  const [chatInitialized, setChatInitialized] = useState(false);
  const initializeChat = useHomepageInitializeChat(chatId, setChatInitialized);
  const storeMessageHistory = useStoreMessageHistory();
  useNewChatContainerSetup();
  const initialMessages = useInitialMessages(chatInitialized ? chatId : undefined);
  useBackupSyncState(chatId, initialMessages?.loadedSubchatIndex, initialMessages?.deserialized);

  return {
    initializeChat,
    storeMessageHistory,
    initialMessages: !initialMessages ? initialMessages : initialMessages?.deserialized,
  };
}

export function useConvexChatExisting(chatId: string) {
  useTeamsInitializer();
  useProjectInitializer(chatId);
  const initializeChat = useExistingInitializeChat(chatId);
  const initialMessages = useInitialMessages(chatId);
  useBackupSyncState(chatId, initialMessages?.loadedSubchatIndex, initialMessages?.deserialized);
  const storeMessageHistory = useStoreMessageHistory();
  useExistingChatContainerSetup(initialMessages?.loadedChatId);

  return {
    initialMessages: !initialMessages ? initialMessages : initialMessages?.deserialized,
    initializeChat,
    storeMessageHistory,
  };
}
