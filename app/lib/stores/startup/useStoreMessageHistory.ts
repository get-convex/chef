import { useState, useRef, useCallback, useEffect } from 'react';
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

type MessagePart = Message['parts'] extends Array<infer P> | undefined ? P : never;

export function useStoreMessageHistory(chatId: string, initialMessages: SerializedMessage[] | undefined) {
  const convex = useConvex();
  const [persistedState, setPersistedState] = useState<{
    lastMessageRank: number;
    partIndex: number;
    lastPart: MessagePart | null;
  }>({
    lastMessageRank: -1,
    partIndex: 0,
    lastPart: null,
  });
  const persistInProgress = useRef(false);
  const siteUrl = getConvexSiteUrl();
  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {
        // No-op
      };
    }
    const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      if (persistInProgress.current) {
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

      const sessionId = await waitForConvexSessionId('useStoreMessageHistory');
      const updateResult = shouldUpdateMessages(messages, persistedState);
      if (updateResult.kind === 'noUpdate') {
        return;
      }
      const url = new URL(`${siteUrl}/store_messages`);
      const compressed = await compressMessages(messages);
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
      setPersistedState(updateResult);
    },
    [convex, chatId, initialMessages, persistedState, persistInProgress],
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

function shouldUpdateMessages(
  messages: Message[],
  persisted: {
    lastMessageRank: number;
    partIndex: number;
    lastPart: MessagePart | null;
  },
): { kind: 'update'; lastMessageRank: number; partIndex: number; lastPart: MessagePart | null } | { kind: 'noUpdate' } {
  if (messages.length > persisted.lastMessageRank) {
    return {
      kind: 'update',
      lastMessageRank: messages.length - 1,
      partIndex: (messages.at(-1)?.parts?.length ?? 0) - 1,
      lastPart: messages.at(-1)?.parts?.at(-1) ?? null,
    };
  }
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.parts === undefined) {
    throw new Error('Last message has no parts');
  }
  if (lastMessage.parts.length > persisted.partIndex) {
    return {
      kind: 'update',
      lastMessageRank: messages.length - 1,
      partIndex: lastMessage.parts.length - 1,
      lastPart: lastMessage.parts.at(-1) ?? null,
    };
  }
  if (lastMessage.parts[lastMessage.parts.length - 1] !== persisted.lastPart) {
    return {
      kind: 'update',
      lastMessageRank: messages.length - 1,
      partIndex: lastMessage.parts.length - 1,
      lastPart: lastMessage.parts.at(-1) ?? null,
    };
  }
  return { kind: 'noUpdate' };
}

async function compressMessages(messages: Message[]): Promise<Uint8Array> {
  const serialized = messages.map(serializeMessageForConvex);
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
