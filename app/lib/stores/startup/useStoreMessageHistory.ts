import { useRef, useCallback, useEffect } from 'react';
import type { Message } from '@ai-sdk/react';
import { useConvex } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { SerializedMessage } from '@convex/messages';
import { waitForConvexSessionId } from '~/lib/stores/sessionId';
import { setKnownUrlId, setKnownInitialId, getKnownUrlId } from '~/lib/stores/chatId';
import { description } from '~/lib/stores/description';
import * as lz4 from 'lz4-wasm';
import { getConvexSiteUrl } from '~/lib/convexSiteUrl';
import { toast } from 'sonner';

export function useStoreMessageHistory(chatId: string, initialMessages: SerializedMessage[] | undefined) {
  const convex = useConvex();
  const lastSeenMessageRank = useRef(-1);
  const lastSeenPartIndex = useRef(-1);
  const lastPersistedMessageRank = useRef(-1);
  const lastPersistedPartIndex = useRef(-1);
  const persistInProgress = useRef(false);
  const siteUrl = getConvexSiteUrl();
  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {
        // No-op
      };
    }
    const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      if (
        persistInProgress.current ||
        lastSeenMessageRank.current !== lastPersistedMessageRank.current ||
        lastSeenPartIndex.current !== lastPersistedPartIndex.current
      ) {
        // Some browsers require both preventDefault and setting returnValue
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
      return undefined;
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);
    return () => {
      window.removeEventListener('beforeunload', beforeUnloadHandler);
    };
  }, []);

  return useCallback(
    async (messages: Message[], streamStatus: 'streaming' | 'submitted' | 'ready' | 'error') => {
      if (initialMessages === undefined) {
        throw new Error('Storing message history before initial messages are loaded');
      }
      if (messages.length === 0) {
        return;
      }
      lastSeenMessageRank.current = messages.length - 1;
      lastSeenPartIndex.current = (messages[messages.length - 1].parts?.length ?? 0) - 1;
      if (persistInProgress.current) {
        return;
      }

      const sessionId = await waitForConvexSessionId('useStoreMessageHistory');
      const updateResult = shouldUpdateMessages({
        messages,
        persisted: {
          lastMessageRank: lastPersistedMessageRank.current,
          partIndex: lastPersistedPartIndex.current,
        },
        streamStatus,
      });
      if (updateResult.kind === 'noUpdate') {
        return;
      }
      const url = new URL(`${siteUrl}/store_messages`);
      const compressed = await compressMessages(messages, updateResult.lastMessageRank, updateResult.partIndex);
      url.searchParams.set('chatId', chatId);
      url.searchParams.set('sessionId', sessionId);
      url.searchParams.set('lastMessageRank', updateResult.lastMessageRank.toString());
      url.searchParams.set('partIndex', updateResult.partIndex.toString());

      persistInProgress.current = true;
      // If there's no URL ID yet, try to extract it from the messages.
      // The server will allocate a unique URL ID based on the hint.
      if (getKnownUrlId() === undefined) {
        const result = extractUrlHintAndDescription(messages);
        if (result) {
          const { urlId, initialId } = await convex.mutation(api.messages.setUrlId, {
            sessionId,
            chatId,
            urlHint: result.urlHint,
            description: result.description,
          });
          description.set(result.description);
          setKnownUrlId(urlId);
          setKnownInitialId(initialId);
        }
      }
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          body: compressed,
        });
      } catch (_e) {
        toast.error('Failed to store message history');
      } finally {
        persistInProgress.current = false;
      }
      if (response !== undefined && !response.ok) {
        toast.error('Failed to store message history');
        return;
      }
      lastPersistedMessageRank.current = updateResult.lastMessageRank;
      lastPersistedPartIndex.current = updateResult.partIndex;
    },
    [convex, chatId, initialMessages, persistInProgress],
  );
}

function extractUrlHintAndDescription(messages: Message[]) {
  /*
   * This replicates the original bolt.diy behavior of client-side assigning a URL + description
   * based on the first artifact registered.
   *
   * I suspect there's a bug somewhere here since the first artifact tends to be named "imported-files"
   *
   * Example: <boltArtifact id="imported-files" title="Interactive Tic Tac Toe Game"
   */
  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (part.type === 'text') {
        const content = part.text;
        const match = content.match(/<boltArtifact id="([^"]+)" title="([^"]+)"/);
        if (match) {
          return { urlHint: match[1], description: match[2] };
        }
      }
    }
  }
  return null;
}

export function serializeMessageForConvex(message: Message) {
  // `content` + `toolInvocations` are legacy fields that are duplicated in `parts`.
  // We should avoid storing them since we already store `parts`.
  const { content: _content, toolInvocations: _toolInvocations, ...rest } = message;

  // Process parts to remove file content from bolt actions
  const processedParts = message.parts?.map((part) => {
    if (part.type === 'text') {
      // Remove content between <boltAction type="file"> tags while preserving the tags
      return {
        ...part,
        text: part.text.replace(/<boltAction type="file"[^>]*>[\s\S]*?<\/boltAction>/g, (match) => {
          // Extract the opening tag and return it with an empty content
          const openingTag = match.match(/<boltAction[^>]*>/)?.[0] ?? '';
          return `${openingTag}</boltAction>`;
        }),
      };
    }
    return part;
  });

  return {
    ...rest,
    parts: processedParts,
    createdAt: message.createdAt?.getTime() ?? undefined,
  };
}

function getPreceedingPart(
  messages: Message[],
  args: { messageIndex: number; partIndex: number },
): { messageIndex: number; partIndex: number } | null {
  if (messages.length === 0) {
    return null;
  }
  if (args.messageIndex >= messages.length) {
    let messageIndex = messages.length - 1;
    while (messageIndex >= 0) {
      const message = messages[messageIndex];
      if (message.parts!.length > 0) {
        return { messageIndex, partIndex: message.parts!.length - 1 };
      }
      messageIndex--;
    }
    return null;
  }
  const message = messages[args.messageIndex];
  const parts = message.parts ?? [];
  if (args.partIndex >= parts.length) {
    return { messageIndex: args.messageIndex, partIndex: parts.length - 1 };
  }
  if (args.partIndex === 0) {
    let messageIndex = args.messageIndex - 1;
    while (messageIndex >= 0) {
      const message = messages[messageIndex];
      if (message.parts!.length > 0) {
        return { messageIndex, partIndex: message.parts!.length - 1 };
      }
      messageIndex--;
    }
    return null;
  }
  return { messageIndex: args.messageIndex, partIndex: args.partIndex - 1 };
}

// Exported for testing
export function getLastCompletePart(
  messages: Message[],
  streamStatus: 'streaming' | 'submitted' | 'ready' | 'error',
): { messageIndex: number; partIndex: number } | null {
  if (messages.length === 0) {
    return null;
  }
  const lastPartIndices = getPreceedingPart(messages, { messageIndex: messages.length, partIndex: 0 });
  if (lastPartIndices === null) {
    return null;
  }
  const lastMessage = messages[lastPartIndices.messageIndex];
  const lastPart = lastMessage.parts![lastPartIndices.partIndex];
  if (lastPart === null) {
    throw new Error('Last part is null');
  }
  if (lastPart.type === 'tool-invocation') {
    if (lastPart.toolInvocation.state === 'result') {
      return { messageIndex: lastPartIndices.messageIndex, partIndex: lastPartIndices.partIndex };
    } else {
      return getPreceedingPart(messages, lastPartIndices);
    }
  }
  if (streamStatus !== 'streaming') {
    return { messageIndex: lastPartIndices.messageIndex, partIndex: lastPartIndices.partIndex };
  } else {
    return getPreceedingPart(messages, lastPartIndices);
  }
}

function shouldUpdateMessages({
  messages,
  persisted,
  streamStatus,
}: {
  messages: Message[];
  persisted: {
    lastMessageRank: number;
    partIndex: number;
  };
  streamStatus: 'streaming' | 'submitted' | 'ready' | 'error';
}): { kind: 'update'; lastMessageRank: number; partIndex: number } | { kind: 'noUpdate' } {
  const lastCompletePart = getLastCompletePart(messages, streamStatus);
  if (lastCompletePart === null) {
    return { kind: 'noUpdate' };
  }
  if (
    lastCompletePart.messageIndex === persisted.lastMessageRank &&
    lastCompletePart.partIndex === persisted.partIndex
  ) {
    return { kind: 'noUpdate' };
  }
  return { kind: 'update', lastMessageRank: lastCompletePart.messageIndex, partIndex: lastCompletePart.partIndex };
}

async function compressMessages(messages: Message[], lastMessageRank: number, partIndex: number): Promise<Uint8Array> {
  const slicedMessages = messages.slice(0, lastMessageRank + 1);
  slicedMessages[lastMessageRank].parts = slicedMessages[lastMessageRank].parts?.slice(0, partIndex + 1);
  const serialized = slicedMessages.map(serializeMessageForConvex);
  // Dynamic import only executed on the client
  if (typeof window === 'undefined') {
    throw new Error('compressMessages can only be used in browser environments');
  }

  const textEncoder = new TextEncoder();
  const uint8Array = textEncoder.encode(JSON.stringify(serialized));
  // Dynamically load the module
  const compressed = lz4.compress(uint8Array);
  return compressed;
}
