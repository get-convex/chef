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

export interface InitialMessages {
  loadedChatId: string;
  serialized: SerializedMessage[];
  deserialized: Message[];
}

export function useInitialMessages(chatId: string): InitialMessages | undefined {
  const convex = useConvex();
  const [initialMessages, setInitialMessages] = useState<InitialMessages | undefined>();
  useEffect(() => {
    const loadInitialMessages = async () => {
      const sessionId = await waitForConvexSessionId('loadInitialMessages');
      try {
        const rawMessages = await convex.mutation(api.messages.getInitialMessages, {
          id: chatId,
          sessionId,
          rewindToMessageId: null,
        });
        if (rawMessages === null) {
          return;
        }
        setKnownInitialId(rawMessages.initialId);
        if (rawMessages.urlId) {
          setKnownUrlId(rawMessages.urlId);
        }

        // Transform messages to convert partial-call states to failed states
        const transformedMessages = rawMessages.messages.map((message) => {
          if (!message.parts) {
            return message;
          }

          const updatedParts = message.parts.map((part) => {
            if (part.type === 'tool-invocation' && part.toolInvocation.state === 'partial-call') {
              return {
                ...part,
                toolInvocation: {
                  ...part.toolInvocation,
                  state: 'result' as const,
                  result: 'Error: Tool call was interrupted',
                },
              };
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
          loadedChatId: rawMessages.id,
          serialized: transformedMessages,
          deserialized: deserializedMessages,
        });
        description.set(rawMessages.description);
      } catch (error) {
        toast.error('Failed to load chat messages from Convex. Reload the page?');
        console.error('Error fetching initial messages:', error);
      }
    };
    void loadInitialMessages();
  }, [convex, chatId]);

  return initialMessages;
}

function deserializeMessageForConvex(message: SerializedMessage): Message {
  return {
    ...message,
    createdAt: message.createdAt ? new Date(message.createdAt) : undefined,
  };
}
