import { memo, useMemo } from 'react';
import { Markdown } from './Markdown';
import type { Message } from 'ai';
import { ToolCall } from './ToolCall';
import { makePartId } from 'chef-agent/partId.js';
import { ExclamationTriangleIcon, DotFilledIcon } from '@radix-ui/react-icons';
import { parseAnnotations, type ProviderType, type Usage, type UsageAnnotation } from '~/lib/common/annotations';
import { useLaunchDarkly } from '~/lib/hooks/useLaunchDarkly';
import { calculateChefTokens, usageFromGeneration, type ChefTokenBreakdown } from '~/lib/common/usage';
interface AssistantMessageProps {
  message: Message;
}

export const AssistantMessage = memo(function AssistantMessage({ message }: AssistantMessageProps) {
  const { showUsageAnnotations } = useLaunchDarkly();
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
        const success = part.toolInvocation.state === 'result' && !part.toolInvocation.result.startsWith('Error: ');
        children.push(
          displayModelAndUsage({
            model,
            usageAnnotation: usage ?? undefined,
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
        usageAnnotation: finalUsage ?? undefined,
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
  usageAnnotation,
  success,
}: {
  model: { provider: ProviderType; model: string | undefined } | undefined;
  usageAnnotation: UsageAnnotation | undefined;
  success: boolean;
}) {
  const modelDisplay = displayModel(model ?? { provider: 'Unknown', model: undefined });
  // Note: These numbers are the LLM-reported tokens, not Chef tokens (i.e. not
  // what we use to bill users). This attempts to take into account the logic where
  // we don't charge for tokens produced from failed tool calls. This should
  // probably be re-worked to use Chef tokens.

  const usageDisplay = usageAnnotation ? displayUsage(usageAnnotation, success) : null;
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

function displayUsage(usageAnnotation: UsageAnnotation, success: boolean) {
  const usage: Usage = usageFromGeneration({
    usage: usageAnnotation,
    providerMetadata: usageAnnotation.providerMetadata,
  });
  const { chefTokens, breakdown } = calculateChefTokens(usage);
  if (!success) {
    return (
      <div className="text-xs text-content-secondary">
        Chef Tokens: 0 (failed tool call), Breakdown: {displayBreakdownForSingleAnnotation(breakdown)}
      </div>
    );
  }
  return (
    <div className="text-xs text-content-secondary">
      Chef Tokens: {chefTokens}, Breakdown: {displayBreakdownForSingleAnnotation(breakdown)}
    </div>
  );
}

function displayBreakdownForSingleAnnotation(breakdown: ChefTokenBreakdown) {
  // A single annotation should always have a single provider.
  if (breakdown.completionTokens.anthropic > 0) {
    return `${breakdown.promptTokens.anthropic.uncached} prompt uncached, ${breakdown.promptTokens.anthropic.cached} prompt cached, ${breakdown.completionTokens.anthropic} completion`;
  }
  if (breakdown.completionTokens.openai > 0) {
    return `${breakdown.promptTokens.openai.uncached} prompt uncached, ${breakdown.promptTokens.openai.cached} prompt cached, ${breakdown.completionTokens.openai} completion`;
  }
  if (breakdown.completionTokens.xai > 0) {
    return `${breakdown.promptTokens.xai.uncached} prompt uncached, ${breakdown.promptTokens.xai.cached} prompt cached, ${breakdown.completionTokens.xai} completion`;
  }
  if (breakdown.completionTokens.google > 0) {
    return `${breakdown.promptTokens.google.uncached} prompt uncached, ${breakdown.promptTokens.google.cached} prompt cached, ${breakdown.completionTokens.google} completion`;
  }
  if (breakdown.completionTokens.bedrock > 0) {
    return `${breakdown.promptTokens.bedrock.uncached} prompt uncached, ${breakdown.promptTokens.bedrock.cached} prompt cached, ${breakdown.completionTokens.bedrock} completion`;
  }
  return 'unknown';
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
