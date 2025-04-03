import type { Message } from 'ai';
import { useCallback, useState } from 'react';
import { StreamingMessageParser } from '~/lib/runtime/message-parser';
import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useMessageParser');

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
      // we only add shell actions when when the close tag got parsed because only then we have the content
      if (data.action.type === 'file') {
        workbenchStore.addAction(data);
      }
    },
    onActionClose: (data) => {
      if (data.action.type !== 'file') {
        workbenchStore.addAction(data);
      }
      workbenchStore.runAction(data);
    },
    onActionStream: (data) => {
      workbenchStore.runAction(data, true);
    },
  },
});

function processMessage(message: Message): string {
  if (!message.parts) {
    return message.content;
  }
  const result = [];
  const artifactId = `toolArtifact-${message.id}`;
  let createdArtifact = false;
  for (const part of message.parts) {
    switch (part.type) {
      case 'text': {
        result.push(part.text);
        break;
      }
      case 'tool-invocation': {
        const { toolInvocation } = part;
        if (!createdArtifact) {
          workbenchStore.addArtifact({
            id: artifactId,
            messageId: message.id,
            title: 'Agentic Coding',
          });
          createdArtifact = true;
        }
        const data = {
          artifactId,
          messageId: message.id,
          actionId: toolInvocation.toolCallId,
          action: {
            type: 'toolUse' as const,
            toolName: toolInvocation.toolName,
            content: JSON.stringify(toolInvocation),
          },
        };
        workbenchStore.addAction(data);
        if (toolInvocation.state === 'call' || toolInvocation.state === 'result') {
          workbenchStore.runAction(data);
        }
        break;
      }
      case 'step-start': {
        continue;
      }
      default: {
        logger.warn('unknown part type', JSON.stringify(part));
        break;
      }
    }
  }
  return result.join('\n');
}

export function useMessageParser() {
  const [parsedMessages, setParsedMessages] = useState<{ [key: number]: { content: string; parts: Message['parts'] } }>(
    {},
  );

  const parseMessages = useCallback((messages: Message[], isLoading: boolean) => {
    let reset = false;

    if (import.meta.env.DEV && !isLoading) {
      reset = true;
      messageParser.reset();
    }

    for (const [index, message] of messages.entries()) {
      if (message.role === 'assistant' || message.role === 'user') {
        const content = processMessage(message);
        const newParsedContent = messageParser.parse(message.id, content);
        setParsedMessages((prevParsed) => {
          const newContent = reset ? newParsedContent : (prevParsed[index]?.content || '') + newParsedContent;
          return { ...prevParsed, [index]: { content: newContent, parts: message.parts } };
        });
      }
    }
  }, []);

  return { parsedMessages, parseMessages };
}
