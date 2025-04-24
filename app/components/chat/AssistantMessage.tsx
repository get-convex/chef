import { memo, useMemo } from 'react';
import { Markdown } from './Markdown';
import type { Message } from 'ai';
import { ToolCall } from './ToolCall';
import { makePartId } from 'chef-agent/partId.js';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { failedDueToRepeatedErrors, getModelForParts, parseAnnotations } from '~/lib/common/annotations';
interface AssistantMessageProps {
  message: Message;
}

export const AssistantMessage = memo(function AssistantMessage({ message }: AssistantMessageProps) {
  const parsedAnnotations = useMemo(() => parseAnnotations(message.annotations), [message.annotations]);
  const toolCallIdsForParts = useMemo(
    () =>
      message.parts?.map((part) => (part.type === 'tool-invocation' ? part.toolInvocation?.toolCallId : null)) ?? [],
    [message.parts],
  );
  const models = useMemo(
    () => getModelForParts(toolCallIdsForParts, parsedAnnotations.modelForToolCall),
    [JSON.stringify(toolCallIdsForParts), parsedAnnotations.modelForToolCall],
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
      children.push(
        <ToolCall
          key={children.length}
          partId={partId}
          toolCallId={part.toolInvocation.toolCallId}
          model={models[index]}
          usage={parsedAnnotations.usageForToolCall[part.toolInvocation.toolCallId]}
        />,
      );
    }
    if (part.type === 'text') {
      children.push(
        <div key={children.length} className="flex flex-col gap-2">
          <Markdown html>{part.text}</Markdown>
          <div className="text-xs text-content-secondary">{models[index]}</div>
        </div>,
      );
    }
  }

  return (
    <div className="w-full overflow-hidden text-sm">
      <div className="flex flex-col gap-2">
        {children}
        {parsedAnnotations.failedDueToRepeatedErrors && (
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
