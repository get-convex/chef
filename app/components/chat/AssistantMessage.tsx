import { memo, useMemo } from 'react';
import { Markdown } from './Markdown';
import type { Message } from 'ai';
import { ToolCall } from './ToolCall';
import { makePartId } from 'chef-agent/partId.js';
import { ExclamationTriangleIcon, DotIcon, DotFilledIcon } from '@radix-ui/react-icons';
import { parseAnnotations, type ModelType, type Usage } from '~/lib/common/annotations';
interface AssistantMessageProps {
  message: Message;
}

export const AssistantMessage = memo(function AssistantMessage({ message }: AssistantMessageProps) {
  const parsedAnnotations = useMemo(() => parseAnnotations(message.annotations), [message.annotations]);
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
      const model = parsedAnnotations.modelForToolCall[part.toolInvocation.toolCallId];
      const usage = parsedAnnotations.usageForToolCall[part.toolInvocation.toolCallId];
      const success = part.toolInvocation.state === 'result' && part.toolInvocation.result.status === 'success';
      children.push(
        displayModelAndUsage({
          model,
          usage: usage ?? undefined,
          success,
        }),
      );
      children.push(<ToolCall key={children.length} partId={partId} toolCallId={part.toolInvocation.toolCallId} />);
    }
    if (part.type === 'text') {
      console.log('part.text', part);
      children.push(<Markdown html>{part.text}</Markdown>);
    }
  }
  const finalModel = parsedAnnotations.modelForToolCall['final'];
  const finalUsage = parsedAnnotations.usageForToolCall['final'];
  children.push(
    displayModelAndUsage({
      model: finalModel,
      usage: finalUsage ?? undefined,
      success: true,
    }),
  );
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

function displayModelAndUsage({
  model,
  usage,
  success,
}: {
  model: ModelType | undefined;
  usage: Usage | undefined;
  success: boolean;
}) {
  const modelDisplay = displayModel(model);
  const usageDisplay =
    usage && success ? (
      <div className="text-xs text-content-secondary">
        Tokens: {usage.totalTokens} ({usage.promptTokens} prompt, {usage.completionTokens} completion)
      </div>
    ) : null;
  if (modelDisplay && usageDisplay) {
    return (
      <div className="flex items-center gap-1">
        {modelDisplay}
        <DotFilledIcon className="size-2" />
        {usageDisplay}
      </div>
    );
  }
  return modelDisplay ?? usageDisplay;
}

function displayModel(model: ModelType | undefined) {
  if (!model) {
    return null;
  }
  switch (model) {
    case 'unknown':
      return null;
    case 'anthropic':
      return <div className="text-xs text-content-secondary">Generated with Anthropic</div>;
    case 'openai':
      return <div className="text-xs text-content-secondary">Generated with OpenAI</div>;
    case 'xai':
      return <div className="text-xs text-content-secondary">Generated with XAI</div>;
    case 'google':
      return <div className="text-xs text-content-secondary">Generated with Google</div>;
    default: {
      const _exhaustiveCheck: never = model;
      return null;
    }
  }
}
