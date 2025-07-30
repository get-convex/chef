import type { Message } from '@ai-sdk/react';
import { atom } from 'nanostores';
import { getConvexSiteUrl } from '~/lib/convexSiteUrl';
import { getKnownUrlId, setKnownInitialId, setKnownUrlId } from '~/lib/stores/chatId';
import type { Id } from '@convex/_generated/dataModel';
import type { ConvexReactClient } from 'convex/react';
import { api } from '@convex/_generated/api';
import { description as descriptionStore } from '~/lib/stores/description';
import { compressWithLz4 } from '~/lib/compression';
import { stripMetadata } from '~/components/chat/UserMessage';

type CompleteMessageInfo = {
  messageIndex: number;
  partIndex: number;
  hasNextPart: boolean;
  allMessages: Message[];
};

export const lastCompleteMessageInfoStore = atom<CompleteMessageInfo | null>(null);

export async function prepareMessageHistory(args: {
  chatId: string;
  sessionId: string;
  completeMessageInfo: CompleteMessageInfo;
  persistedMessageInfo: { messageIndex: number; partIndex: number };
  subchatIndex: number;
}): Promise<{
  url: URL;
  update: {
    compressed: Uint8Array;
    urlHintAndDescription: { urlHint: string; description: string } | undefined;
    messageIndex: number;
    partIndex: number;
    firstMessage: string | undefined;
  } | null;
}> {
  const { chatId, sessionId, completeMessageInfo, persistedMessageInfo } = args;
  const { messageIndex, partIndex, allMessages } = completeMessageInfo;
  const siteUrl = getConvexSiteUrl();
  const url = new URL(`${siteUrl}/store_chat`);

  url.searchParams.set('chatId', chatId);
  url.searchParams.set('sessionId', sessionId);
  url.searchParams.set('lastMessageRank', messageIndex.toString());
  url.searchParams.set('partIndex', partIndex.toString());
  url.searchParams.set('lastSubchatIndex', args.subchatIndex.toString());
  const firstMessage = allMessages.length > 0 ? stripMetadata(allMessages[0].content) : undefined;
  if (messageIndex === persistedMessageInfo.messageIndex && partIndex === persistedMessageInfo.partIndex) {
    // No changes
    return { url, update: null };
  }

  let urlHintAndDescription: { urlHint: string; description: string } | undefined;
  if (getKnownUrlId() === undefined) {
    urlHintAndDescription = extractUrlHintAndDescription(allMessages) ?? undefined;
  }
  const compressed = await compressMessages(allMessages, messageIndex, partIndex);
  return { url, update: { compressed, urlHintAndDescription, messageIndex, partIndex, firstMessage } };
}

export async function handleUrlHintAndDescription(
  convex: ConvexReactClient,
  chatId: string,
  sessionId: Id<'sessions'>,
  urlHint: string,
  description: string,
) {
  if (getKnownUrlId() === undefined) {
    const { urlId, initialId } = await convex.mutation(api.messages.setUrlId, {
      sessionId,
      chatId,
      urlHint,
      description,
    });
    descriptionStore.set(description);
    setKnownUrlId(urlId);
    setKnownInitialId(initialId);
  }
}

export async function waitForNewMessages(messageIndex: number, partIndex: number, alertOnNextPartStart: boolean) {
  return new Promise<void>((resolve) => {
    let unsubscribe: (() => void) | null = null;
    unsubscribe = lastCompleteMessageInfoStore.subscribe((lastCompleteMessageInfo) => {
      if (
        lastCompleteMessageInfo !== null &&
        (lastCompleteMessageInfo.messageIndex !== messageIndex ||
          lastCompleteMessageInfo.partIndex !== partIndex ||
          (alertOnNextPartStart && lastCompleteMessageInfo.hasNextPart))
      ) {
        if (unsubscribe !== null) {
          unsubscribe();
          unsubscribe = null;
        }
        resolve();
      }
    });
  });
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
        // Don't match on "Relevant Files" messages
        const match = content.match(/<boltArtifact id="([^"]+)" title="(?!Relevant Files)([^"]+)"/);
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

  return {
    ...rest,
    parts: message.parts,
    createdAt: message.createdAt?.getTime() ?? undefined,
  };
}

async function compressMessages(messages: Message[], lastMessageRank: number, partIndex: number): Promise<Uint8Array> {
  const slicedMessages = messages.slice(0, lastMessageRank + 1);
  slicedMessages[lastMessageRank].parts = slicedMessages[lastMessageRank].parts?.slice(0, partIndex + 1);
  const serialized = slicedMessages.map(serializeMessageForConvex);

  const textEncoder = new TextEncoder();
  const uint8Array = textEncoder.encode(JSON.stringify(serialized));
  return compressWithLz4(uint8Array);
}
