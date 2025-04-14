import { memo } from 'react';
import { Markdown } from './Markdown';
import type { Message } from 'ai';
import { ToolCall } from './ToolCall';
import { makePartId } from '~/lib/stores/artifacts';

interface AssistantMessageProps {
  message: Message;
}

export const AssistantMessage = memo(({ message }: AssistantMessageProps) => {
  if (!message.parts) {
    return (
      <div className="w-full overflow-hidden">
        <Markdown html>{message.content}</Markdown>
      </div>
    );
  }
  const children: React.ReactNode[] = [];
  for (const [index, part] of message.parts.entries()) {
    const partId = makePartId(message.id, index);
    if (part.type === 'tool-invocation') {
      children.push(<ToolCall key={children.length} partId={partId} toolCallId={part.toolInvocation.toolCallId} />);
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
    <div className="w-full overflow-hidden">
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
});
