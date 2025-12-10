import type { UIMessage } from 'ai';
import { isToolUIPart } from 'ai';
import { useCallback, useRef, useState } from 'react';
import { StreamingMessageParser } from 'chef-agent/message-parser';
import { workbenchStore } from '~/lib/stores/workbench.client';
import { makePartId, type PartId } from 'chef-agent/partId';
import type { BoltAction } from 'chef-agent/types';
import { EXCLUDED_FILE_PATHS } from 'chef-agent/constants';
import type { LegacyCompatibleMessage } from '~/lib/common/messageHelpers';

export const messageParser = new StreamingMessageParser({
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

// Part type - using UIMessage parts from AI SDK 5
type LegacyPart = UIMessage['parts'][number];

export type PartCache = Map<PartId, { original: LegacyPart; parsed: LegacyPart }>;

function isPartMaybeEqual(a: LegacyPart, b: LegacyPart): boolean {
  if (a.type === 'text' && b.type === 'text') {
    return a.text === b.text;
  }
  // Handle AI SDK 5 tool parts (type starts with 'tool-')
  if (isToolUIPart(a as any) && isToolUIPart(b as any)) {
    const aToolPart = a as any;
    const bToolPart = b as any;
    // Consider equal if same toolCallId and both have output available
    if (aToolPart.state === 'output-available' && bToolPart.state === 'output-available') {
      return aToolPart.toolCallId === bToolPart.toolCallId;
    }
  }
  return false;
}

export function processMessage(
  message: LegacyCompatibleMessage,
  previousParts: PartCache,
): { message: LegacyCompatibleMessage; hitRate: [number, number] } {
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
    // Check for AI SDK 5 tool parts (type: 'tool-${toolName}')
    if (isToolUIPart(part)) {
      // AI SDK 5 format: type is 'tool-${toolName}', properties are input/output
      const toolPart = part as any;
      const toolName = toolPart.type.replace(/^tool-/, '');

      // Convert AI SDK 5 state to legacy state format for compatibility
      let legacyState: 'partial-call' | 'call' | 'result';
      if (toolPart.state === 'input-streaming') {
        legacyState = 'partial-call';
      } else if (toolPart.state === 'input-available') {
        legacyState = 'call';
      } else {
        // output-available or output-error
        legacyState = 'result';
      }

      // Create a legacy-compatible toolInvocation object
      const toolInvocation = {
        toolCallId: toolPart.toolCallId,
        toolName,
        state: legacyState,
        args: toolPart.input,
        result: toolPart.output != null ? String(toolPart.output) : undefined,
      };

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
      if (legacyState === 'call' || legacyState === 'result') {
        workbenchStore.runAction(data);
      }
      newPart = part; // Keep the original part for rendering
    } else if (part.type === 'text') {
      let prevContent = '';
      if (cacheEntry && cacheEntry.parsed.type === 'text') {
        prevContent = cacheEntry.parsed.text;
      }
      const delta = messageParser.parse(partId, part.text);
      newPart = {
        type: 'text' as const,
        text: prevContent + delta,
      };
    } else {
      newPart = part;
    }
    parsedParts.push(newPart);
    previousParts.set(partId, { original: part, parsed: newPart });
  }
  return {
    message: {
      ...message,
      parts: parsedParts as any,
    },
    hitRate: [hits, (message.parts ?? []).length],
  };
}

export function useMessageParser(partCache: PartCache) {
  const [parsedMessages, setParsedMessages] = useState<LegacyCompatibleMessage[]>([]);

  const previousMessages = useRef<{ original: LegacyCompatibleMessage; parsed: LegacyCompatibleMessage }[]>([]);
  const previousParts = useRef<PartCache>(partCache);

  const parseMessages = useCallback((messages: LegacyCompatibleMessage[]) => {
    const nextPrevMessages: { original: LegacyCompatibleMessage; parsed: LegacyCompatibleMessage }[] = [];

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
