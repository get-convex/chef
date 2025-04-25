import type { Message, UIMessage } from 'ai';
import { useCallback, useRef, useState } from 'react';
import { StreamingMessageParser } from 'chef-agent/message-parser';
import { workbenchStore } from '~/lib/stores/workbench.client';
import { makePartId, type PartId } from 'chef-agent/partId';
import type { BoltAction } from 'chef-agent/types';
import { EXCLUDED_FILE_PATHS } from 'chef-agent/constants';

const messageParser = new StreamingMessageParser({
  callbacks: {
    onArtifactOpen: (data) => {
      workbenchStore.showWorkbench.set(true);
      workbenchStore.addArtifact(data);
    },
    onArtifactClose: (data) => {
      workbenchStore.updateArtifact(data, { closed: true });
    },
    onActionOpen: (data) => {
      // We want to prevent the LLM from modifying `convex/auth.ts`
      if (isValidAction(data.action)) {
        workbenchStore.addAction(data);
      }
    },
    onActionClose: (data) => {
      if (data.action.type !== 'file') {
        workbenchStore.addAction(data);
      }
      if (isValidAction(data.action)) {
        workbenchStore.runAction(data);
      }
    },
    onActionStream: (data) => {
      if (isValidAction(data.action)) {
        workbenchStore.runAction(data, true);
      }
    },
  },
});

export type PartCache = Map<PartId, { original: Part; parsed: Part }>;

function isPartMaybeEqual(a: Part, b: Part): boolean {
  if (a.type === 'text' && b.type === 'text') {
    return a.text === b.text;
  }
  if (a.type === 'tool-invocation' && b.type === 'tool-invocation') {
    if (a.toolInvocation.state === 'result' && b.toolInvocation.state === 'result') {
      return a.toolInvocation.toolCallId === b.toolInvocation.toolCallId;
    }
  }
  return false;
}

export function processMessage(
  message: Message,
  previousParts: PartCache,
): { message: Message; hitRate: [number, number] } {
  if (message.role === 'user') {
    return { message, hitRate: [0, 0] };
  }
  if (!message.parts) {
    throw new Error('Message has no parts');
  }
  const parsedParts = [];
  let hits = 0;
  for (let i = 0; i < message.parts.length; i++) {
    const part = message.parts[i];
    const partId = makePartId(message.id, i);
    const cacheEntry = previousParts.get(partId);
    if (cacheEntry && isPartMaybeEqual(cacheEntry.original, part)) {
      parsedParts.push(cacheEntry.parsed);
      hits++;
      continue;
    }
    let newPart;
    switch (part.type) {
      case 'text': {
        let prevContent = '';
        if (cacheEntry && cacheEntry.parsed.type === 'text') {
          prevContent = cacheEntry.parsed.text;
        }
        const delta = messageParser.parse(partId, part.text);
        newPart = {
          type: 'text' as const,
          text: prevContent + delta,
        };
        break;
      }
      case 'tool-invocation': {
        const { toolInvocation } = part;
        workbenchStore.addArtifact({
          id: partId,
          partId,
          title: 'Editing files...',
        });
        const data = {
          artifactId: partId,
          partId,
          actionId: toolInvocation.toolCallId,
          action: {
            type: 'toolUse' as const,
            toolName: toolInvocation.toolName,
            parsedContent: toolInvocation,
            content: JSON.stringify(toolInvocation),
          },
        };
        workbenchStore.addAction(data);
        if (toolInvocation.state === 'call' || toolInvocation.state === 'result') {
          workbenchStore.runAction(data);
        }
        newPart = {
          type: 'tool-invocation' as const,
          toolInvocation,
        };
      }
      default: {
        newPart = part;
      }
    }
    parsedParts.push(newPart);
    previousParts.set(partId, { original: part, parsed: newPart });
  }
  return {
    message: {
      ...message,
      parts: parsedParts,
    },
    hitRate: [hits, message.parts.length],
  };
}

type Part = UIMessage['parts'][number];

export function useMessageParser(partCache: PartCache) {
  const [parsedMessages, setParsedMessages] = useState<Message[]>([]);

  const previousMessages = useRef<{ original: Message; parsed: Message }[]>([]);
  const previousParts = useRef<PartCache>(partCache);

  const parseMessages = useCallback((messages: Message[]) => {
    const nextPrevMessages: { original: Message; parsed: Message }[] = [];

    for (let i = 0; i < messages.length; i++) {
      const prev = previousMessages.current[i];
      const message = messages[i];
      if (!prev) {
        const { message: parsed } = processMessage(message, previousParts.current);
        nextPrevMessages.push({ original: message, parsed });
        continue;
      }
      if (prev.original === message) {
        nextPrevMessages.push(prev);
        continue;
      }
      const { message: parsed } = processMessage(message, previousParts.current);
      nextPrevMessages.push({ original: message, parsed });
    }
    previousMessages.current = nextPrevMessages;
    setParsedMessages(nextPrevMessages.map((p) => p.parsed));
  }, []);

  return { parsedMessages, parseMessages };
}

function isValidAction(action: BoltAction): boolean {
  if (action.type === 'file') {
    return !EXCLUDED_FILE_PATHS.some((excludedPath) => action.filePath.includes(excludedPath));
  }
  return true;
}
