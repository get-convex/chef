import { useCallback } from 'react';
import type { Message } from '@ai-sdk/react';
import { lastCompleteMessageInfoStore } from '~/lib/stores/startup/messages';

/**
 * This returns a function that takes in `messages` and `streamStatus` and updates
 * the state of the last complete part of the messages (e.g. tool invocation that has finished, text part that is done streaming, etc.).
 *
 * The `chatSyncWorker` reads from this state and persists it to the database.
 *
 * Additionally, this adds a `beforeunload` listener that triggers whenever the
 * messages it's observed (including incomplete parts) is beyond the persisted
 * state to prevent the user from closing the tab too early.
 */
export function useStoreMessageHistory() {
  return useCallback(async (messages: Message[], streamStatus: 'streaming' | 'submitted' | 'ready' | 'error') => {
    if (messages.length === 0) {
      return;
    }

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

    // This is the point where we need to fix the messages before they are stored.
    const messagesToStore = messages.map(serializeMessageForStorage);

    lastCompleteMessageInfoStore.set({
      messageIndex: lastCompleteMessageInfo.messageIndex,
      partIndex: lastCompleteMessageInfo.partIndex,
      allMessages: messagesToStore,
      hasNextPart: lastCompleteMessageInfo.hasNextPart,
    });
  }, []);
}

/**
 * This function ensures that for any given message, if it has textual content,
 * that content is represented as a 'text' part within the 'parts' array.
 * This is crucial for correct storage and later retrieval, as the UI rendering
 * logic for multi-part messages relies on the `parts` array exclusively.
 * @param message The message from the AI SDK state.
 * @returns A message object ready for serialization.
 */
function serializeMessageForStorage(message: Message): Message {
  if (message.role === 'assistant' && message.content) {
    const newParts: Message['parts'] = [];

    // Add the text content as the first part.
    newParts.push({ type: 'text', text: message.content });

    // Add any existing non-text parts (like tool calls).
    if (message.parts) {
      message.parts.forEach((part) => {
        if (part.type !== 'text') {
          newParts.push(part);
        }
      });
    }

    return {
      ...message,
      parts: newParts,
    };
  }

  return message;
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
): { messageIndex: number; partIndex: number; hasNextPart: boolean } | null {
  if (messages.length === 0) {
    return null;
  }
  const lastPartIndices = getPreceedingPart(messages, { messageIndex: messages.length, partIndex: 0 });
  if (lastPartIndices === null) {
    return null;
  }
  const lastMessage = messages[lastPartIndices.messageIndex];
  if (lastMessage === null || lastMessage.parts === undefined) {
    throw new Error('Last message is null or has no parts');
  }
  const lastPart = lastMessage.parts[lastPartIndices.partIndex];
  if (lastPart === null) {
    throw new Error('Last part is null');
  }

  const isLastPartComplete =
    lastPart.type === 'tool-invocation' ? lastPart.toolInvocation.state === 'result' : streamStatus !== 'streaming';
  if (isLastPartComplete) {
    return {
      messageIndex: lastPartIndices.messageIndex,
      partIndex: lastPartIndices.partIndex,
      // This handles the edge case where the last message is empty
      hasNextPart: lastPartIndices.messageIndex !== messages.length - 1,
    };
  }
  const preceedingPart = getPreceedingPart(messages, lastPartIndices);
  if (preceedingPart === null) {
    return null;
  }
  return { messageIndex: preceedingPart.messageIndex, partIndex: preceedingPart.partIndex, hasNextPart: true };
}
