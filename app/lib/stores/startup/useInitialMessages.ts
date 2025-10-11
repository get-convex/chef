import { useState, useEffect } from 'react';
import { useConvex } from 'convex/react';
import { waitForConvexSessionId } from '~/lib/stores/sessionId';
import { api } from '@convex/_generated/api';
import type { SerializedMessage } from '@convex/messages';
import type { Message } from '@ai-sdk/react';
import { setKnownUrlId } from '~/lib/stores/chatId';
import { setKnownInitialId } from '~/lib/stores/chatId';
import { description } from '~/lib/stores/description';
import { toast } from 'sonner';
import * as lz4 from 'lz4-wasm';
import { getConvexSiteUrl } from '~/lib/convexSiteUrl';
import { subchatIndexStore } from '~/lib/stores/subchats';
import { useStore } from '@nanostores/react';
import { customSystemPromptStore } from '~/lib/stores/customSystemPrompt';

export interface InitialMessages {
  loadedChatId: string;
  serialized: SerializedMessage[];
  deserialized: Message[];
  loadedSubchatIndex: number;
}

export function useInitialMessages(chatId: string | undefined):
  | InitialMessages
  | null // not found
  | undefined {
  const convex = useConvex();
  const [initialMessages, setInitialMessages] = useState<InitialMessages | null | undefined>();
  const subchatIndex = useStore(subchatIndexStore);

  useEffect(() => {
    const loadInitialMessages = async () => {
      const sessionId = await waitForConvexSessionId('loadInitialMessages');
      try {
        const siteUrl = getConvexSiteUrl();
        if (!chatId) {
          setInitialMessages(undefined);
          return;
        }
        const chatInfo = await convex.query(api.messages.get, {
          id: chatId,
          sessionId,
        });
        if (chatInfo === null) {
          setInitialMessages(null);
          customSystemPromptStore.set(undefined);
          return;
        }
        if (subchatIndex === undefined) {
          subchatIndexStore.set(chatInfo.subchatIndex);
          // Exit early to let the effect run again with the new subchatIndex
          return;
        }

        setKnownInitialId(chatInfo.initialId);
        if (chatInfo.urlId) {
          setKnownUrlId(chatInfo.urlId);
        }
        const subchatIndexToFetch = subchatIndex ?? chatInfo.subchatIndex;
        const initialMessagesResponse = await fetch(`${siteUrl}/initial_messages`, {
          method: 'POST',
          body: JSON.stringify({
            chatId,
            sessionId,
            subchatIndex: subchatIndexToFetch,
          }),
        });
        if (!initialMessagesResponse.ok) {
          throw new Error('Failed to fetch initial messages');
        }

        if (initialMessagesResponse.status === 204) {
          setInitialMessages({
            loadedChatId: chatInfo.urlId ?? chatInfo.initialId,
            serialized: [],
            deserialized: [],
            loadedSubchatIndex: subchatIndexToFetch,
          });
          customSystemPromptStore.set(chatInfo.customSystemPrompt ?? undefined);
          return;
        }
        const content = await initialMessagesResponse.arrayBuffer();
        const initialMessages = await decompressMessages(new Uint8Array(content));

        // Transform messages to convert partial-call states to failed states
        const transformedMessages = initialMessages.map((message) => {
          if (!message.parts) {
            return message;
          }

          const updatedParts = message.parts.map((part) => {
            if (part.type === 'tool-invocation') {
              // We could potentially handle these better by making the action runner
              // handle the interrupted calls, but treat these as failed states for now.
              if (part.toolInvocation.state === 'partial-call' || part.toolInvocation.state === 'call') {
                return {
                  ...part,
                  toolInvocation: {
                    ...part.toolInvocation,
                    state: 'result' as const,
                    result: 'Error: Tool call was interrupted',
                  },
                };
              }
            }
            return part;
          });

          return {
            ...message,
            parts: updatedParts,
          };
        });

        const deserializedMessages = transformedMessages.map(deserializeMessageForConvex);
        setInitialMessages({
          loadedChatId: chatInfo.urlId ?? chatInfo.initialId,
          serialized: transformedMessages,
          deserialized: deserializedMessages,
          loadedSubchatIndex: subchatIndexToFetch,
        });
        description.set(chatInfo.description);
        customSystemPromptStore.set(chatInfo.customSystemPrompt ?? undefined);
      } catch (error) {
        toast.error('Failed to load chat messages from Convex. Try reloading the page.');
        console.error('Error fetching initial messages:', error);
      }
    };
    void loadInitialMessages();
  }, [convex, chatId, subchatIndex]);

  return initialMessages;
}

function deserializeMessageForConvex(message: SerializedMessage): Message {
  const content =
    message.content ??
    message.parts
      ?.filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('') ??
    '';

  return {
    ...message,
    createdAt: message.createdAt ? new Date(message.createdAt) : undefined,
    content,
  };
}

async function decompressMessages(compressed: Uint8Array): Promise<SerializedMessage[]> {
  // Dynamic import only executed on the client
  if (typeof window === 'undefined') {
    throw new Error('decompressSnapshot can only be used in browser environments');
  }

  // Dynamically load the module
  const decompressed = lz4.decompress(compressed);
  const textDecoder = new TextDecoder();
  const deserialized = JSON.parse(textDecoder.decode(decompressed));
  if (!Array.isArray(deserialized)) {
    throw new Error('Unexpected state -- decompressed data is not an array');
  }
  return deserialized;
}
