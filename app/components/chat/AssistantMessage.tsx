import { memo, useMemo } from 'react';
import { Markdown } from './Markdown';
import type { Message } from 'ai';
import { ToolCall } from './ToolCall';
import { makePartId } from 'chef-agent/partId.js';
import { ExclamationTriangleIcon, DotFilledIcon } from '@radix-ui/react-icons';
import { parseAnnotations, type ProviderType, type UsageAnnotation } from '~/lib/common/annotations';
import { useFlags } from 'launchdarkly-react-client-sdk';
interface AssistantMessageProps {
  message: Message;
}

export const AssistantMessage = memo(function AssistantMessage({ message }: AssistantMessageProps) {
  const { showUsageAnnotations } = useFlags();
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
      if (showUsageAnnotations) {
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
      }
      children.push(<ToolCall key={children.length} partId={partId} toolCallId={part.toolInvocation.toolCallId} />);
    }
    if (part.type === 'text') {
      children.push(<Markdown html>{part.text}</Markdown>);
    }
  }
  if (showUsageAnnotations) {
    const finalModel = parsedAnnotations.modelForToolCall.final;
    const finalUsage = parsedAnnotations.usageForToolCall.final;
    children.push(
      displayModelAndUsage({
        model: finalModel,
        usage: finalUsage ?? undefined,
        success: true,
      }),
    );
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

function displayModelAndUsage({
  model,
  usage,
  success,
}: {
  model: { provider: ProviderType; model: string | undefined } | undefined;
  usage: UsageAnnotation | undefined;
  success: boolean;
}) {
  const modelDisplay = displayModel(model ?? { provider: 'Unknown', model: undefined });
  // Note: These numbers are the LLM-reported tokens, not Chef tokens (i.e. not
  // what we use to bill users). This attempts to take into account the logic where
  // we don't charge for tokens produced from failed tool calls. This should
  // probably be re-worked to use Chef tokens.
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

function displayModel(modelInfo: { provider: ProviderType; model: string | undefined }) {
  if (!modelInfo) {
    return null;
  }
  switch (modelInfo.provider) {
    case 'Unknown':
      return null;
    case 'Anthropic':
    case 'Bedrock':
      return <div className="text-xs text-content-secondary">Generated with Anthropic</div>;
    case 'OpenAI':
      return <div className="text-xs text-content-secondary">Generated with OpenAI</div>;
    case 'XAI':
      return <div className="text-xs text-content-secondary">Generated with xAI</div>;
    case 'Google':
      return <div className="text-xs text-content-secondary">Generated with Google</div>;
    default: {
      const _exhaustiveCheck: never = modelInfo.provider;
      return null;
    }
  }
}
