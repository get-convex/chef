import { useStoreMessageHistory } from './useStoreMessageHistory';
import { useInitializeChat } from './useInitializeChat';
import { useInitialMessages } from './useInitialMessages';
import { useProjectInitializer } from './useProjectInitializer';
import { useTeamsInitializer } from './useTeamsInitializer';

export function useConvexChatHomepage(chatId: string) {
  useTeamsInitializer();
  useProjectInitializer(chatId);
  const initializeChat = useInitializeChat(chatId);
  const storeMessageHistory = useStoreMessageHistory(chatId, []);
  return {
    initializeChat,
    storeMessageHistory,
  };
}

export function useConvexChatExisting(chatId: string) {
  useTeamsInitializer();
  useProjectInitializer(chatId);
  const initializeChat = useInitializeChat(chatId);
  const { ready, initialMessages, initialDeserializedMessages } = useInitialMessages(chatId);
  const storeMessageHistory = useStoreMessageHistory(chatId, initialMessages);
  return {
    ready,
    initialMessages: initialDeserializedMessages,
    initializeChat,
    storeMessageHistory,
  };
}





