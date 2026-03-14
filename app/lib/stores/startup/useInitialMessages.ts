import { useState, useEffect } from 'react';
import { useConvex } from 'convex/react';
import { waitForConvexSessionId } from '~/lib/stores/sessionId';
import { api } from '@convex/_generated/api';
import type { SerializedMessage } from '@convex/messages';
import type { UIMessage } from '@ai-sdk/react';
import { setKnownUrlId } from '~/lib/stores/chatId';
import { setKnownInitialId } from '~/lib/stores/chatId';
import { description } from '~/lib/stores/description';
import { toast } from 'sonner';
import * as lz4 from 'lz4-wasm';
import { getConvexSiteUrl } from '~/lib/convexSiteUrl';
import { subchatIndexStore } from '~/lib/stores/subchats';
import { useStore } from '@nanostores/react';

export interface InitialMessages {
  loadedChatId: string;
  serialized: SerializedMessage[];
  deserialized: UIMessage[];
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
          return;
        }
        const content = await initialMessagesResponse.arrayBuffer();
        const initialMessages = await decompressMessages(new Uint8Array(content));

        // Transform messages to handle legacy tool invocation states and convert
        // interrupted calls to error states
        const transformedMessages = initialMessages.map((message) => {
          if (!message.parts) {
            return message;
          }

          const updatedParts = message.parts.map((part: any) => {
            // Handle legacy tool-invocation format (v4) and convert to v6 format
            if (part.type === 'tool-invocation') {
              const inv = part.toolInvocation;
              const toolType = `tool-${inv.toolName}` as const;
              if (
                inv.state === 'partial-call' ||
                inv.state === 'call' ||
                inv.state === 'input-streaming' ||
                inv.state === 'input-available'
              ) {
                // Interrupted tool calls become output-available with error
                return {
                  type: toolType,
                  toolCallId: inv.toolCallId,
                  toolName: inv.toolName,
                  state: 'output-available' as const,
                  input: inv.args ?? inv.input ?? {},
                  output: 'Error: Tool call was interrupted',
                };
              }
              if (inv.state === 'result' || inv.state === 'output-available') {
                return {
                  type: toolType,
                  toolCallId: inv.toolCallId,
                  toolName: inv.toolName,
                  state: 'output-available' as const,
                  input: inv.args ?? inv.input ?? {},
                  output: inv.result ?? inv.output ?? '',
                };
              }
              // Fallback
              return {
                type: toolType,
                toolCallId: inv.toolCallId,
                toolName: inv.toolName,
                state: 'output-available' as const,
                input: inv.args ?? inv.input ?? {},
                output: 'Error: Unknown tool state',
              };
            }
            // Handle v6 tool parts that may have been interrupted
            if ('toolCallId' in part && part.state) {
              if (part.state === 'input-streaming' || part.state === 'input-available') {
                return {
                  ...part,
                  state: 'output-available' as const,
                  output: 'Error: Tool call was interrupted',
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
      } catch (error) {
        toast.error('Failed to load chat messages from Convex. Try reloading the page.');
        console.error('Error fetching initial messages:', error);
      }
    };
    void loadInitialMessages();
  }, [convex, chatId, subchatIndex]);

  return initialMessages;
}

function deserializeMessageForConvex(message: SerializedMessage): UIMessage {
  return {
    id: message.id,
    role: message.role as UIMessage['role'],
    parts: (message.parts ?? []) as UIMessage['parts'],
    metadata:
      ((message as any).metadata ?? (message as any).annotations)
        ? { annotations: (message as any).annotations }
        : undefined,
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
