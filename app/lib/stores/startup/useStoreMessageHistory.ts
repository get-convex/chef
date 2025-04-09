import { useState, useRef, useCallback } from 'react';
import type { Message } from '@ai-sdk/react';
import { useConvex } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { SerializedMessage } from '@convex/messages';
import { waitForConvexSessionId } from '~/lib/stores/sessionId';
import { setKnownUrlId, setKnownInitialId } from '~/lib/stores/chatId';
import { description } from '~/lib/stores/description';

export function useStoreMessageHistory(chatId: string, initialMessages: SerializedMessage[] | undefined) {
  const convex = useConvex();

  // The messages that have been persisted to the database
  const [persistedMessages, setPersistedMessages] = useState<Message[]>([]);
  const persistInProgress = useRef(false);

  return useCallback(
    async (messages: Message[]) => {
      if (initialMessages === undefined) {
        throw new Error('Storing message history before initial messages are loaded');
      }
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
    [convex, chatId, initialMessages, persistedMessages, setPersistedMessages, persistInProgress],
  );
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

function serializeMessageForConvex(message: Message) {
  return {
    ...message,
    createdAt: message.createdAt?.getTime() ?? undefined,
  };
}
