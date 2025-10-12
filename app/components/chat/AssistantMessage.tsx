import { memo, useMemo } from 'react';
import { Markdown } from './Markdown';
import type { Message } from 'ai';
import { ToolCall } from './ToolCall';
import { makePartId, type PartId } from 'chef-agent/partId.js';
import { ExclamationTriangleIcon, DotFilledIcon } from '@radix-ui/react-icons';
import { parseAnnotations, type ProviderType, type Usage, type UsageAnnotation } from '~/lib/common/annotations';
import { useLaunchDarkly } from '~/lib/hooks/useLaunchDarkly';
import { calculateChefTokens, usageFromGeneration, type ChefTokenBreakdown } from '~/lib/common/usage';
import { captureMessage } from '@sentry/remix';

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

  return (
    <div className="w-full overflow-hidden text-sm">
      <div className="flex flex-col gap-2">
        {message.parts.map((part, index) => (
          <AssistantMessagePart
            key={index}
            part={part}
            showUsageAnnotations={showUsageAnnotations}
            partId={makePartId(message.id, index)}
            parsedAnnotations={parsedAnnotations}
          />
        ))}

        {showUsageAnnotations &&
          displayModelAndUsage({
            model: parsedAnnotations.modelForToolCall.final,
            usageAnnotation: parsedAnnotations.usageForToolCall.final ?? undefined,
            showUsageAnnotations,
          })}

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

function AssistantMessagePart({
  part,
  showUsageAnnotations,
  partId,
  parsedAnnotations,
}: {
  part: NonNullable<Message['parts']>[number];
  showUsageAnnotations: boolean;
  partId: PartId;
  parsedAnnotations: ReturnType<typeof parseAnnotations>;
}) {
  if (part.type === 'tool-invocation') {
    return (
      <>
        {showUsageAnnotations &&
          displayModelAndUsage({
            model: parsedAnnotations.modelForToolCall[part.toolInvocation.toolCallId],
            usageAnnotation: parsedAnnotations.usageForToolCall[part.toolInvocation.toolCallId] ?? undefined,
            showUsageAnnotations,
          })}

        <ToolCall partId={partId} toolCallId={part.toolInvocation.toolCallId} />
      </>
    );
  }

  if (part.type === 'text') {
    return <Markdown html>{part.text}</Markdown>;
  }

  if (part.type === 'step-start') {
    return null;
  }

  captureMessage('Unknown part type ' + part.type);
  return null;
}

function displayModelAndUsage({
  model,
  usageAnnotation,
  showUsageAnnotations,
}: {
  model: { provider: ProviderType; model: string | undefined } | undefined;
  usageAnnotation: UsageAnnotation | undefined;
  showUsageAnnotations: boolean;
}) {
  const modelDisplay = displayModel(model ?? { provider: 'Unknown', model: undefined });
  // Note: These numbers are the LLM-reported tokens, not Chef tokens (i.e. not
  // what we use to bill users). This attempts to take into account the logic where
  // we don't charge for tokens produced from failed tool calls. This should
  // probably be re-worked to use Chef tokens.

  const usageDisplay = usageAnnotation
    ? displayUsage(usageAnnotation, model?.provider ?? 'Unknown', showUsageAnnotations)
    : null;
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

function displayChefTokenNumber(num: number) {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(0)}K`;
  }
  return num.toString();
}

function displayUsage(usageAnnotation: UsageAnnotation, provider: ProviderType, showUsageAnnotations: boolean) {
  const usage: Usage = usageFromGeneration({
    usage: usageAnnotation,
    providerMetadata: usageAnnotation.providerMetadata,
  });
  const { chefTokens, breakdown } = calculateChefTokens(usage, provider);
  return (
    <div className="text-xs text-content-secondary">
      Chef Tokens: {displayChefTokenNumber(chefTokens)}
      {showUsageAnnotations ? `, ${displayBreakdownForSingleAnnotation(breakdown)}` : ''}
    </div>
  );
}

function displayBreakdownForSingleAnnotation(breakdown: ChefTokenBreakdown) {
  // A single annotation should always have a single provider.
  if (breakdown.completionTokens.anthropic > 0) {
    return `${displayChefTokenNumber(breakdown.promptTokens.anthropic.uncached)} uncached, ${displayChefTokenNumber(breakdown.promptTokens.anthropic.cached)} cached, ${displayChefTokenNumber(breakdown.completionTokens.anthropic)} completion`;
  }
  if (breakdown.completionTokens.openai > 0) {
    return `${displayChefTokenNumber(breakdown.promptTokens.openai.uncached)} uncached, ${displayChefTokenNumber(breakdown.promptTokens.openai.cached)} cached, ${displayChefTokenNumber(breakdown.completionTokens.openai)} completion`;
  }
  if (breakdown.completionTokens.xai > 0) {
    return `${displayChefTokenNumber(breakdown.promptTokens.xai.uncached)} uncached, ${displayChefTokenNumber(breakdown.promptTokens.xai.cached)} cached, ${displayChefTokenNumber(breakdown.completionTokens.xai)} completion`;
  }
  if (breakdown.completionTokens.google > 0) {
    return `${displayChefTokenNumber(breakdown.promptTokens.google.uncached)} uncached, ${displayChefTokenNumber(breakdown.promptTokens.google.cached)} cached, ${displayChefTokenNumber(breakdown.completionTokens.google)} completion`;
  }
  if (breakdown.completionTokens.bedrock > 0) {
    return `${displayChefTokenNumber(breakdown.promptTokens.bedrock.uncached)} uncached, ${displayChefTokenNumber(breakdown.promptTokens.bedrock.cached)} cached, ${displayChefTokenNumber(breakdown.completionTokens.bedrock)} completion`;
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
    case 'OpenRouter':
      return <div className="text-xs text-content-secondary">Generated with OpenRouter</div>;
    default: {
      const _exhaustiveCheck: never = modelInfo.provider;
      return null;
    }
  }
}
