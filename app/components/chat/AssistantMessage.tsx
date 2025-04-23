import { memo, useMemo } from 'react';
import { Markdown } from './Markdown';
import type { Message } from 'ai';
import { ToolCall } from './ToolCall';
import { makePartId } from 'chef-agent/partId.js';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { failedDueToRepeatedErrors } from '~/lib/common/errors';
interface AssistantMessageProps {
  message: Message;
}

export const AssistantMessage = memo(function AssistantMessage({ message }: AssistantMessageProps) {
  const stoppedDueToFailedToolCalls = useMemo(
    () => failedDueToRepeatedErrors(message.annotations),
    [message.annotations],
  );
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
    <div className="w-full overflow-hidden text-sm">
      <div className="flex flex-col gap-2">
        {children}
        {stoppedDueToFailedToolCalls && (
          <div className="flex items-center gap-2 text-content-primary">
            <ExclamationTriangleIcon className="size-6" />
            <div className="inline">
              <span className="font-bold">Note:</span> The chat stopped because of repeated errors. You can send a
              message to try again, give more information, or fix the problem yourself.
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
