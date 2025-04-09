import { useState, useEffect, useRef, useCallback } from 'react';
import { atom } from 'nanostores';
import type { Message } from '@ai-sdk/react';
import { useConvex } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { SerializedMessage } from '@convex/messages';
import { flexAuthModeStore, useTeamsInitializer, waitForConvexSessionId, waitForSelectedTeamSlug } from '~/lib/stores/convex';
import { webcontainer } from '~/lib/webcontainer';
import { loadSnapshot } from '~/lib/snapshot';
import { makePartId, type PartId } from '~/lib/stores/artifacts';
import { useAuth0 } from '@auth0/auth0-react';
import { setKnownUrlId, setKnownInitialId } from './chatIdStore';

export interface ChatHistoryItem {
  /*
   * ID should be the urlId (if it's set) or the initialId, and callers should be able
   * to handle either
   */
  id: string;
  initialId: string;
  urlId?: string;
  description?: string;
  timestamp: string;
}

export const description = atom<string | undefined>(undefined);

export function useConvexChatHomepage(chatId: string) {
  useTeamsInitializer();
  const initializeChat = useInitializeChat(chatId);
  const storeMessageHistory = useStoreMessageHistory(chatId, []);
  return {
    initializeChat,
    storeMessageHistory,
  };
}

export function useConvexChatExisting(chatId: string) {
  useTeamsInitializer();
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

function useInitializeChat(chatId: string) {
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

function useStoreMessageHistory(chatId: string, initialMessages: SerializedMessage[]) {
  const convex = useConvex();

  // The messages that have been persisted to the database
  const [persistedMessages, setPersistedMessages] = useState<Message[]>([]);
  const persistInProgress = useRef(false);

  return useCallback(
    async (messages: Message[]) => {
      if (messages.length === 0) {
        return;
      }
      if (persistInProgress.current) {
        return;
      }
      const { messagesToUpdate, startIndex } = findMessagesToUpdate(
        initialMessages.length,
        persistedMessages,
        messages,
      );
      if (messagesToUpdate.length === 0) {
        return;
      }

      const sessionId = await waitForConvexSessionId('useStoreMessageHistory');

      persistInProgress.current = true;
      let result;
      try {
        result = await convex.mutation(api.messages.addMessages, {
          id: chatId,
          sessionId,
          messages: messagesToUpdate.map(serializeMessageForConvex),
          expectedLength: messages.length,
          startIndex,
        });
      } finally {
        persistInProgress.current = false;
      }
      setPersistedMessages(messages);

      // Update the description + URL ID if they have changed
      if (description.get() !== result.description) {
        description.set(result.description);
      }
      if (result.initialId) {
        setKnownInitialId(result.initialId);
      }
      if (result.urlId) {
        setKnownUrlId(result.urlId);
      }
    },
    [convex, chatId, initialMessages, persistedMessages, persistInProgress, setPersistedMessages],
  );
}

function useInitialMessages(chatId: string) {
  const convex = useConvex();

  // Messages that should be displayed + fed into the chat -- this is a prefix
  // of the messages stored in the database (because there's a feature to rewind to a user message)
  const [initialMessages, setInitialMessages] = useState<SerializedMessage[]>([]);
  // The deserialized version of `initialMessages`
  const [initialDeserializedMessages, setInitialDeserializedMessages] = useState<Message[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loadInitialMessages = async () => {
      const sessionId = await waitForConvexSessionId('loadInitialMessages');
      try {
        const rawMessages = await convex.mutation(api.messages.getInitialMessages, {
          id: chatId,
          sessionId,
          rewindToMessageId: null,
        });
        if (rawMessages === null || rawMessages.messages.length === 0) {
          return;
        }

        setKnownInitialId(rawMessages.initialId);
        if (rawMessages.urlId) {
          setKnownUrlId(rawMessages.urlId);
        }

        setInitialMessages(rawMessages.messages);

        const deserializedMessages = rawMessages.messages.map(deserializeMessageForConvex);
        setInitialDeserializedMessages(deserializedMessages);

        description.set(rawMessages.description);

        const container = await webcontainer;
        const { workbenchStore } = await import('~/lib/stores/workbench');

        const partIds: PartId[] = [];
        for (const message of rawMessages.messages) {
          if (message.parts) {
            for (let i = 0; i < message.parts.length; i++) {
              partIds.push(makePartId(message.id, i));
            }
          }
        }
        workbenchStore.setReloadedParts(partIds);
        await loadSnapshot(container, workbenchStore, rawMessages.id);
        setReady(true);
      } catch (error) {
        console.error('Error fetching initial messages:', error);
      } finally {
        setIsLoading(false);
      }
    };
    void loadInitialMessages();
  }, [convex, chatId, setReady, setIsLoading]);

  return {
    ready: ready && !isLoading,
    isLoading,
    initialMessages,
    initialDeserializedMessages,
  };
}

function serializeMessageForConvex(message: Message) {
  return {
    ...message,
    createdAt: message.createdAt?.getTime() ?? undefined,
  };
}

function deserializeMessageForConvex(message: SerializedMessage): Message {
  return {
    ...message,
    createdAt: message.createdAt ? new Date(message.createdAt) : undefined,
  };
}

function findMessagesToUpdate(
  initialMessagesLength: number,
  persistedMessages: Message[],
  currentMessages: Message[],
): {
  messagesToUpdate: Message[];
  startIndex?: number;
} {
  if (persistedMessages.length > currentMessages.length) {
    console.error('Unexpected state -- more persisted messages than current messages');
    return {
      messagesToUpdate: [],
      startIndex: undefined,
    };
  }

  if (initialMessagesLength > persistedMessages.length) {
    // Initial messages should never change. Update with everything after the initial messages.
    return {
      messagesToUpdate: currentMessages.slice(initialMessagesLength),
      startIndex: initialMessagesLength,
    };
  }

  /*
   * We assume that changes to the messages either are edits to the last persisted message, or
   * new messages.
   *
   * We want to avoid sending the entire message history on every change, so we only send the
   * changed messages.
   *
   * In theory, `Message` that are semantically the same are `===` to each other, but empirically
   * that's not always true. But occasional false positive means extra no-op calls to persistence,
   * which should be fine (the persisted state should still be correct).
   */
  for (let i = persistedMessages.length - 1; i < currentMessages.length; i++) {
    if (currentMessages[i] !== persistedMessages[i]) {
      return {
        messagesToUpdate: currentMessages.slice(i),
        startIndex: i,
      };
    }
  }

  return {
    messagesToUpdate: [],
    startIndex: undefined,
  };
}
