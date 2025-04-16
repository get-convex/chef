import { useRef, useCallback, useEffect } from 'react';
import type { Message } from '@ai-sdk/react';
import { ConvexReactClient, useConvex } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { SerializedMessage } from '@convex/messages';
import { waitForConvexSessionId } from '~/lib/stores/sessionId';
import { setKnownUrlId, setKnownInitialId, getKnownUrlId } from '~/lib/stores/chatId';
import { description } from '~/lib/stores/description';
import * as lz4 from 'lz4-wasm';
import { getConvexSiteUrl } from '~/lib/convexSiteUrl';
import { toast } from 'sonner';
import { atom } from 'nanostores';
import { chatSyncState, lastCompleteMessageInfoStore } from './history';

async function handleStoreMessageHistory(chatId: string, convex: ConvexReactClient) {
  const lastCompleteMessageInfo = lastCompleteMessageInfoStore.get();
  const lastPersistedMessageInfo = lastPersistedMessageInfoStore.get();
  if (lastCompleteMessageInfo === null || lastPersistedMessageInfo === null) {
    // Not initialized yet
    return;
  }
  const { messageIndex, partIndex, allMessages } = lastCompleteMessageInfo;
  if (messageIndex === lastPersistedMessageInfo.messageIndex && partIndex === lastPersistedMessageInfo.partIndex) {
    // No changes
    return;
  }
  const sessionId = await waitForConvexSessionId('useStoreMessageHistory');
  // If there's no URL ID yet, try to extract it from the messages.
  // The server will allocate a unique URL ID based on the hint.
  if (getKnownUrlId() === undefined) {
    const result = extractUrlHintAndDescription(allMessages);
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
  const siteUrl = getConvexSiteUrl();
  const url = new URL(`${siteUrl}/store_messages`);
  const compressed = await compressMessages(allMessages, messageIndex, partIndex);
  url.searchParams.set('chatId', chatId);
  url.searchParams.set('sessionId', sessionId);
  url.searchParams.set('lastMessageRank', messageIndex.toString());
  url.searchParams.set('partIndex', partIndex.toString());
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: compressed,
    });
  } catch (_e) {
    toast.error('Failed to store message history');
  }
  if (response === undefined || !response.ok) {
    toast.error('Failed to store message history');
    return;
  }
  lastPersistedMessageInfoStore.set({ messageIndex, partIndex });
}

async function storeMessageHistoryWorker(chatId: string, convex: ConvexReactClient) {
  while (true) {
    const lastPersistedMessageInfo = lastPersistedMessageInfoStore.get();
    if (lastPersistedMessageInfo !== null) {
      await waitForNewMessages(lastPersistedMessageInfo.messageIndex, lastPersistedMessageInfo.partIndex);
      await handleStoreMessageHistory(chatId, convex);
    }
  }
}

export async function waitForNewMessages(messageIndex: number, partIndex: number) {
  return new Promise<void>((resolve) => {
    let unlisten: (() => void) | null = null;
    unlisten = lastCompleteMessageInfoStore.listen((lastCompleteMessageInfo) => {
      if (
        lastCompleteMessageInfo !== null &&
        (lastCompleteMessageInfo.messageIndex !== messageIndex || lastCompleteMessageInfo.partIndex !== partIndex)
      ) {
        if (unlisten !== null) {
          unlisten();
          unlisten = null;
        }
        resolve();
      }
    });
  });
}

export function useStoreMessageHistory(chatId: string) {
  const convex = useConvex();
  // Local state that includes incomplete parts too for the beforeunload handler
  const lastMessageRank = useRef(-1);
  const partIndex = useRef(-1);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {
        // No-op
      };
    }
    const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      const lastPersistedMessageInfo = chatSyncState.get().persistedMessageInfo;
      if (lastPersistedMessageInfo !== null) {
        if (
          lastMessageRank.current === lastPersistedMessageInfo.messageIndex &&
          partIndex.current === lastPersistedMessageInfo.partIndex
        ) {
          return;
        }
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
      if (messages.length === 0) {
        return;
      }

      lastMessageRank.current = messages.length - 1;
      partIndex.current = (messages[messages.length - 1].parts?.length ?? 0) - 1;

      const lastCompleteMessageInfo = getLastCompletePart(messages, streamStatus);
      if (lastCompleteMessageInfo === null) {
        return;
      }
      const currentLastCompleteMessageInfo = lastCompleteMessageInfoStore.get();
      if (
        currentLastCompleteMessageInfo !== null &&
        lastCompleteMessageInfo.messageIndex === currentLastCompleteMessageInfo.messageIndex &&
        lastCompleteMessageInfo.partIndex === currentLastCompleteMessageInfo.partIndex
      ) {
        return;
      }
      lastCompleteMessageInfoStore.set({
        messageIndex: lastCompleteMessageInfo.messageIndex,
        partIndex: lastCompleteMessageInfo.partIndex,
        allMessages: messages,
      });
    },
    [convex, chatId],
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
