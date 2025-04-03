import { memo } from 'react';
import { Markdown } from './Markdown';
import type { Message } from 'ai';
import { ToolCall } from './ToolCall';

interface AssistantMessageProps {
  messageId: string;
  content: string;
  parts: Message['parts'];
}

export const AssistantMessage = memo(({ messageId, content, parts }: AssistantMessageProps) => {
  if (!parts || !parts.some((part) => part.type === 'tool-invocation')) {
    return (
      <div className="overflow-hidden w-full">
        <Markdown html>{content}</Markdown>
      </div>
    );
  }
  const children: React.ReactNode[] = [];
  for (const part of parts) {
    if (part.type === 'tool-invocation') {
      children.push(
        <ToolCall key={children.length} messageId={messageId} toolCallId={part.toolInvocation.toolCallId} />,
      );
    }
    if (part.type === 'text') {
      children.push(
        <Markdown key={children.length} html>
          {part.text}
        </Markdown>,
      );
    }
  }
  return (
    <div className="overflow-hidden w-full">
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
});
