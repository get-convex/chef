import { useLoaderData, useNavigate, useSearchParams } from '@remix-run/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { atom } from 'nanostores';
import type { Message } from '@ai-sdk/react';
import { toast } from 'sonner';
import { useConvex } from 'convex/react';
import { api } from '@convex/_generated/api';
import { ConvexError } from 'convex/values';
import type { SerializedMessage } from '@convex/messages';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/convex';
import { webcontainer } from '~/lib/webcontainer';
import { loadSnapshot } from '~/lib/snapshot';
import { makePartId, type PartId } from '~/lib/stores/Artifacts';

interface IChatMetadata {
  gitUrl: string;
  gitBranch?: string;
  netlifySiteId?: string;
}

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
  metadata?: IChatMetadata;
}

/*
 * All chats eventually have two IDs:
 * - The initialId is the ID of the chat when it is first created (a UUID)
 * - The urlId is the ID of the chat that is displayed in the URL. This is a human-friendly ID that is
 *   displayed in the URL.
 *
 * Functions accept either ID.
 *
 * The urlId is set when the first message is added from an LLM response.
 *
 * `chatIdStore` stores the intialId
 */
export const chatIdStore = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);
const chatMetadata = atom<IChatMetadata | undefined>(undefined);

export const useChatHistoryConvex = () => {
  const navigate = useNavigate();

  // mixedId means either an initialId or a urlId
  const { id: mixedId } = useLoaderData<{ id?: string; sessionId?: string }>();
  const [searchParams] = useSearchParams();

  // Messages that should be displayed + fed into the chat -- this is a prefix
  // of the messages stored in the database (because there's a feature to rewind to a user message)
  const [initialMessages, setInitialMessages] = useState<SerializedMessage[]>([]);
  // The deserialized version of `initialMessages`
  const [initialDeserializedMessages, setInitialDeserializedMessages] = useState<Message[]>([]);

  // The messages that have been persisted to the database
  const [persistedMessages, setPersistedMessages] = useState<Message[]>([]);
  const persistInProgress = useRef(false);

  const [ready, setReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const convex = useConvex();
  useEffect(() => {
    if (sessionId === undefined || sessionId === null) {
      return;
    }
    if (mixedId === undefined) {
      navigate('/', { replace: true });
      return;
    }

    setIsLoading(true);
    const currentChatId = chatIdStore.get();
    if (currentChatId && mixedId !== currentChatId) {
      // The chat has changed. Clear all state.

      description.set(undefined);
      chatMetadata.set(undefined);

      setInitialMessages([]);
      setInitialDeserializedMessages([]);

      setPersistedMessages([]);
      persistInProgress.current = false;

      setReady(false);
      setUrlId(undefined);
    }
    const rewindId = searchParams.get('rewindTo');

    convex
      .mutation(api.messages.getInitialMessages, { id: mixedId, sessionId, rewindToMessageId: rewindId })
      .then(async (rawMessages) => {
        if (rawMessages !== null && rawMessages.messages.length > 0) {
          setInitialMessages(rawMessages.messages);
          setInitialDeserializedMessages(rawMessages.messages.map(deserializeMessageForConvex));
          setUrlId(rawMessages.urlId);
          description.set(rawMessages.description);
          chatIdStore.set(rawMessages.initialId);
          chatMetadata.set(rawMessages.metadata);
          try {
            const container = await webcontainer;
            const { workbenchStore } = await import('~/lib/stores/workbench');

            const partIds: PartId[] = [];
            for (const message of rawMessages.messages) {
              for (let i = 0; i < Math.min(1, message.parts?.length ?? 0); i++) {
                partIds.push(makePartId(message.id, i));
              }
            }
            workbenchStore.setReloadedParts(partIds);
            await loadSnapshot(container, workbenchStore, rawMessages.id);
          } catch (error) {
            console.error('Error loading snapshot:', error);
          }
          setReady(true);
        } else {
          console.log('navigating to /');
          navigate('/', { replace: true });
        }

        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching messages:', error);
        setIsLoading(false);
      });
  }, [mixedId, sessionId, convex]);

  return {
    ready: mixedId === undefined || (ready && !isLoading),
    initialMessages: initialDeserializedMessages,
    updateChatMetadata: useCallback(
      async (metadata: IChatMetadata) => {
        const id = chatIdStore.get();

        if (!id || !sessionId) {
          return;
        }

        try {
          await convex.mutation(api.messages.setMetadata, {
            id,
            sessionId,
            metadata,
          });
          chatMetadata.set(metadata);
        } catch (error) {
          toast.error('Failed to update chat metadata');
          console.error(error);
        }
      },
      [convex, sessionId],
    ),
    initializeChat: useCallback(async () => {
      if (!sessionId) {
        console.error('Cannot start chat with no session ID');
        return;
      }

      /*
       * Synchronously allocate a new ID -- this ID is temporary and will be replaced by a
       * more human-friendly ID when the first message is added.
       */
      if (!chatIdStore.get()) {
        const nextId = crypto.randomUUID();
        chatIdStore.set(nextId);
      }

      const id = chatIdStore.get() as string;

      const result = await convex.mutation(api.messages.addMessages, {
        id,
        sessionId,
        messages: [],
        expectedLength: 0,
        startIndex: 0,
      });

      setPersistedMessages([]);
      persistInProgress.current = false;

      if (urlId !== result.id) {
        setUrlId(result.id);
        navigateChat(result.id);
      }
    }, [convex, sessionId]),
    storeMessageHistory: useCallback(
      async (messages: Message[]) => {
        if (messages.length === 0) {
          return;
        }

        if (!sessionId) {
          return;
        }

        /*
         * Synchronously allocate a new ID -- this ID is temporary and will be replaced by a
         * more human-friendly ID when the first message is added.
         */
        if (initialMessages.length === 0 && !chatIdStore.get()) {
          const nextId = crypto.randomUUID();
          chatIdStore.set(nextId);
        }

        const id = chatIdStore.get() as string;

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

        persistInProgress.current = true;

        const result = await convex.mutation(api.messages.addMessages, {
          id,
          sessionId,
          messages: messagesToUpdate.map(serializeMessageForConvex),
          expectedLength: messages.length,
          startIndex,
        });

        setPersistedMessages(messages);
        persistInProgress.current = false;

        // Update the description + URL ID if they have changed
        if (description.get() !== result.description) {
          description.set(result.description);
        }

        if (urlId !== result.id) {
          setUrlId(result.id);
          navigateChat(result.id);
        }
      },
      [convex, sessionId],
    ),
    duplicateCurrentChat: useCallback(
      async (listItemId: string) => {
        if (!sessionId) {
          return;
        }

        if (!mixedId && !listItemId) {
          return;
        }

        try {
          const newId = await convex.mutation(api.messages.duplicate, {
            id: mixedId || listItemId,
            sessionId,
          });
          navigate(`/chat/${newId.id}`);
          toast.success('Chat duplicated successfully');
        } catch (error) {
          toast.error('Failed to duplicate chat');
          console.log(error);
        }
      },
      [convex, sessionId],
    ),
    importChat: useCallback(
      async (description: string, messages: Message[], metadata?: IChatMetadata) => {
        if (!sessionId) {
          return;
        }

        try {
          const newId = await convex.mutation(api.messages.importChat, {
            description,
            messages: messages.map(serializeMessageForConvex),
            metadata,
            sessionId,
          });
          window.location.href = `/chat/${newId}`;
          toast.success('Chat imported successfully');
        } catch (error) {
          if (error instanceof ConvexError) {
            toast.error('Failed to import chat: ' + error.message);
          } else {
            toast.error('Failed to import chat');
          }
        }
      },
      [convex, sessionId],
    ),
    exportChat: useCallback(
      async (id = urlId) => {
        if (!id || !sessionId) {
          return;
        }

        const chat = await convex.query(api.messages.getWithMessages, { id, sessionId });

        if (!chat) {
          return;
        }

        const chatData = {
          messages: chat.messages,
          description: chat.description,
          exportDate: new Date().toISOString(),
        };

        const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-${new Date().toISOString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      [convex, sessionId],
    ),
  };
};

function navigateChat(nextId: string) {
  /**
   * FIXME: Using the intended navigate function causes a rerender for <Chat /> that breaks the app.
   *
   * `navigate(`/chat/${nextId}`, { replace: true });`
   */
  const url = new URL(window.location.href);
  url.pathname = `/chat/${nextId}`;

  window.history.replaceState({}, '', url);
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
