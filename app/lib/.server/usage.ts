import type { LanguageModelUsage, Message, ProviderMetadata } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import { getTokenUsage } from '~/lib/convexUsage';
import { z } from 'zod';
import { createHmac } from 'crypto';

const logger = createScopedLogger('usage');

export async function checkTokenUsage(
  provisionHost: string,
  token: string,
  teamSlug: string,
  deploymentName: string | undefined,
) {
  const tokenUsage = await getTokenUsage(provisionHost, token, teamSlug);
  if (tokenUsage.status === 'error') {
    logger.error(`Failed to check for token usage: ${tokenUsage.httpStatus}: ${tokenUsage.httpBody}`);
  }
  if (tokenUsage.status === 'success') {
    logger.info(`${teamSlug}/${deploymentName}: Tokens used: ${tokenUsage.tokensUsed} / ${tokenUsage.tokensQuota}`);
  }
  return tokenUsage;
}

const annotationValidator = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("usage"),
    usage: z.object({
      payload: z.string(),
      signature: z.string(),
    }),
  }),
])

const usageValidator = z.object({
  toolCallId: z.string(),
  completionTokens: z.number(),
  promptTokens: z.number(),
  totalTokens: z.number(),
  cacheCreationInputTokens: z.number(),
  cacheReadInputTokens: z.number(),
});
type Usage = z.infer<typeof usageValidator>;

if (!process.env.ANNOTATION_SECRET) {
  throw new Error('ANNOTATION_SECRET is not set');
}
const ANNOTATION_SECRET = process.env.ANNOTATION_SECRET;

function computeSignature(payload: string) {
  const hmac = createHmac('sha256', ANNOTATION_SECRET);
  hmac.update(payload);
  return hmac.digest('hex');
}

export function encodeUsageAnnotation(toolCallId: string, usage: LanguageModelUsage, providerMetadata: ProviderMetadata | undefined) {
  const payload: Usage = {
    toolCallId,
    completionTokens: usage.completionTokens,
    promptTokens: usage.promptTokens,
    totalTokens: usage.totalTokens,
    cacheCreationInputTokens: Number(providerMetadata?.anthropic?.cacheCreationInputTokens ?? 0),
    cacheReadInputTokens: Number(providerMetadata?.anthropic?.cacheReadInputTokens ?? 0),
  };
  const serialized = JSON.stringify(payload);
  const signature = computeSignature(serialized);
  return { payload: serialized, signature };
}

export async function recordUsage(
  token: string,
  provisionHost: string,
  teamSlug: string,
  deploymentName: string | undefined,
  lastMessage: Message | undefined,
  finalGeneration: { usage: LanguageModelUsage, providerMetadata?: ProviderMetadata },
) {
  let totalUsage = {
    completionTokens: finalGeneration.usage.completionTokens,
    promptTokens: finalGeneration.usage.promptTokens,
    totalTokens: finalGeneration.usage.totalTokens,
    cacheCreationInputTokens: Number(finalGeneration.providerMetadata?.anthropic?.cacheCreationInputTokens ?? 0),
    cacheReadInputTokens: Number(finalGeneration.providerMetadata?.anthropic?.cacheReadInputTokens ?? 0),
  }

  const failedToolCalls: Set<string> = new Set();
  for (const part of lastMessage?.parts ?? []) {
    if (part.type !== "tool-invocation") {
      continue;
    }
    if (part.toolInvocation.state === "result" && part.toolInvocation.result.startsWith("Error:")) {
      failedToolCalls.add(part.toolInvocation.toolCallId);
    }
  }

  if (lastMessage && lastMessage.role === "assistant") {
    for (const annotation of lastMessage.annotations ?? []) {
      const parsed = annotationValidator.safeParse(annotation);
      if (!parsed.success) {
        console.error('Invalid annotation', parsed.error);
        continue;
      }
      if (parsed.data.type !== "usage") {
        continue;
      }
      const signature = computeSignature(parsed.data.usage.payload);
      if (signature !== parsed.data.usage.signature) {
        console.error('Invalid signature', signature, parsed.data.usage.signature);
        continue;
      }
      let payload: Usage;
      try {
        payload = usageValidator.parse(JSON.parse(parsed.data.usage.payload));
      } catch (e) {
        console.error('Invalid payload', parsed.data.usage.payload, e);
        continue;
      }
      if (failedToolCalls.has(payload.toolCallId)) {
        console.warn('Skipping usage for failed tool call', payload.toolCallId);
        continue;
      }
      totalUsage.completionTokens += payload.completionTokens;
      totalUsage.promptTokens += payload.promptTokens;
      totalUsage.totalTokens += payload.totalTokens;
      totalUsage.cacheCreationInputTokens += payload.cacheCreationInputTokens;
      totalUsage.cacheReadInputTokens += payload.cacheReadInputTokens;
    }
  }

  const Authorization = `Bearer ${token}`;
  const url = `${provisionHost}/api/dashboard/teams/${teamSlug}/usage/record_tokens`;
  // https://www.notion.so/convex-dev/Chef-Pricing-1cfb57ff32ab80f5aa2ecf3420523e2f
  let chefTokens = totalUsage.promptTokens * 40 + totalUsage.completionTokens * 200;
  chefTokens += totalUsage.cacheCreationInputTokens * 40 + totalUsage.cacheReadInputTokens * 3;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tokens: chefTokens,
    }),
  });
  if (!response.ok) {
    logger.error('Failed to record usage', response);
    logger.error(await response.json());
  }

  const { tokensUsed, tokensQuota } = await response.json();
  logger.info(`${teamSlug}/${deploymentName}: Tokens used: ${tokensUsed} / ${tokensQuota}`);
}