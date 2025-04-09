import { useStoreMessageHistory } from './useStoreMessageHistory';
import { useInitializeChat } from './useInitializeChat';
import { useInitialMessages } from './useInitialMessages';
import { useProjectInitializer } from './useProjectInitializer';
import { useTeamsInitializer } from './useTeamsInitializer';
import { useExistingChatContainerSetup, useNewChatContainerSetup } from './useContainerSetup';

export function useConvexChatHomepage(chatId: string) {
  useTeamsInitializer();
  useProjectInitializer(chatId);
  const initializeChat = useInitializeChat(chatId);
  const storeMessageHistory = useStoreMessageHistory(chatId, []);
  useNewChatContainerSetup();
  return {
    initializeChat,
    storeMessageHistory,
  };
}

export function useConvexChatExisting(chatId: string) {
  useTeamsInitializer();
  useProjectInitializer(chatId);
  const initializeChat = useInitializeChat(chatId);
  const initialMessages = useInitialMessages(chatId);
  const storeMessageHistory = useStoreMessageHistory(chatId, initialMessages?.serialized);
  useExistingChatContainerSetup(initialMessages?.loadedChatId);
  return {
    initialMessages: initialMessages?.deserialized,
    initializeChat,
    storeMessageHistory,
  };
}
