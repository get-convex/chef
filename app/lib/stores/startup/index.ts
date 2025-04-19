import { useStoreMessageHistory } from './useStoreMessageHistory';
import { useExistingInitializeChat, useHomepageInitializeChat } from './useInitializeChat';
import { useInitialMessages } from './useInitialMessages';
import { useProjectInitializer } from './useProjectInitializer';
import { useTeamsInitializer } from './useTeamsInitializer';
import { useExistingChatContainerSetup, useNewChatContainerSetup } from './useContainerSetup';
import { useBackupSyncState } from './history';

export function useConvexChatHomepage(chatId: string) {
  useTeamsInitializer();
  useProjectInitializer(chatId);
  const initializeChat = useHomepageInitializeChat(chatId);
  useBackupSyncState(chatId, []);
  const storeMessageHistory = useStoreMessageHistory();
  useNewChatContainerSetup();

  return {
    initializeChat,
    storeMessageHistory,
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
    earliestRewindableMessageRank: initialMessages?.earliestRewindableMessageRank,
  };
}
