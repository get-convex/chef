import { type ActionFunctionArgs } from '@vercel/remix';
import { createScopedLogger } from 'chef-agent/utils/logger';
import { convexAgent } from '~/lib/.server/llm/convex-agent';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import type { LanguageModelUsage, Message, ProviderMetadata } from 'ai';
import { checkTokenUsage, recordUsage } from '~/lib/.server/usage';
import { disabledText, noTokensText } from '~/lib/convexUsage';
import type { ModelProvider } from '~/lib/.server/llm/provider';
import { getEnv } from '~/lib/.server/env';

type Messages = Message[];

const logger = createScopedLogger('api.chat');

export type Tracer = ReturnType<typeof WebTracerProvider.prototype.getTracer>;

export async function chatAction({ request }: ActionFunctionArgs) {
  const AXIOM_API_TOKEN = getEnv('AXIOM_API_TOKEN');
  const AXIOM_API_URL = getEnv('AXIOM_API_URL');
  const AXIOM_DATASET_NAME = getEnv('AXIOM_DATASET_NAME');
  const PROVISION_HOST = getEnv('PROVISION_HOST') || 'https://api.convex.dev';

  let tracer: Tracer | null = null;
  if (AXIOM_API_TOKEN && AXIOM_API_URL && AXIOM_DATASET_NAME) {
    const exporter = new OTLPTraceExporter({
      url: AXIOM_API_URL,
      headers: {
        Authorization: `Bearer ${AXIOM_API_TOKEN}`,
        'X-Axiom-Dataset': AXIOM_DATASET_NAME,
      },
    });
    const provider = new WebTracerProvider({
      spanProcessors: [
        new BatchSpanProcessor(exporter, {
          // The maximum queue size. After the size is reached spans are dropped.
          maxQueueSize: 100,
          // The maximum batch size of every export. It must be smaller or equal to maxQueueSize.
          maxExportBatchSize: 10,
          // The interval between two consecutive exports
          scheduledDelayMillis: 500,
          // How long the export can run before it is cancelled
          exportTimeoutMillis: 30000,
        }),
      ],
    });
    provider.register();
    tracer = provider.getTracer('ai');
    logger.info('✅ Axiom instrumentation registered!');
  } else {
    logger.warn('⚠️ AXIOM_API_TOKEN, AXIOM_API_URL, and AXIOM_DATASET_NAME not set, skipping Axiom instrumentation.');
  }

  const body = (await request.json()) as {
    messages: Messages;
    firstUserMessage: boolean;
    chatInitialId: string;
    token: string;
    teamSlug: string;
    deploymentName: string | undefined;
    modelProvider: ModelProvider;
    modelChoice: string | undefined;
    userApiKey:
      | { preference: 'always' | 'quotaExhausted'; value?: string; openai?: string; xai?: string; google?: string }
      | undefined;
    shouldDisableTools: boolean;
    skipSystemPrompt: boolean;
    smallFiles: boolean;
    recordRawPromptsForDebugging?: boolean;
    collapsedMessages: boolean;
  };
  const { messages, firstUserMessage, chatInitialId, deploymentName, token, teamSlug, recordRawPromptsForDebugging } =
    body;

  let useUserApiKey = false;

  // Use the user's API key if they're set to always mode or if they manually set a model.
  if (body.userApiKey?.preference === 'always' || body.modelChoice) {
    useUserApiKey = true;
  }

  // If they're not set to always mode, check to see if the user has any Convex tokens left.
  if (body.userApiKey?.preference !== 'always') {
    const resp = await checkTokenUsage(PROVISION_HOST, token, teamSlug, deploymentName);
    if (resp.status === 'error') {
      return new Response(JSON.stringify({ error: 'Failed to check for tokens' }), {
        status: resp.httpStatus,
      });
    }
    const { centitokensUsed, centitokensQuota, isTeamDisabled, isPaidPlan } = resp;
    if (isTeamDisabled) {
      return new Response(JSON.stringify({ error: disabledText(isPaidPlan) }), {
        status: 402,
      });
    }
    if (!isPaidPlan && centitokensUsed >= centitokensQuota) {
      if (body.userApiKey?.preference !== 'quotaExhausted') {
        logger.error(`No tokens available for ${deploymentName}: ${centitokensUsed} of ${centitokensQuota}`);
        return new Response(
          JSON.stringify({ code: 'no-tokens', error: noTokensText(centitokensUsed, centitokensQuota) }),
          {
            status: 402,
          },
        );
      }
      // If they're set to quotaExhausted mode, try to use the user's API key.
      useUserApiKey = true;
    }
  }

  let userApiKey: string | undefined;
  if (useUserApiKey) {
    if (body.modelProvider === 'Anthropic' || body.modelProvider === 'Bedrock') {
      userApiKey = body.userApiKey?.value;
      body.modelProvider = 'Anthropic';
    } else if (body.modelProvider === 'OpenAI') {
      userApiKey = body.userApiKey?.openai;
    } else if (body.modelProvider === 'XAI') {
      userApiKey = body.userApiKey?.xai;
    } else {
      userApiKey = body.userApiKey?.google;
    }

    if (!userApiKey) {
      return new Response(
        JSON.stringify({ code: 'missing-api-key', error: `Tried to use missing ${body.modelProvider} API key.` }),
        {
          status: 402,
        },
      );
    }
  }
  logger.info(`Using model provider: ${body.modelProvider} (user API key: ${useUserApiKey})`);

  const recordUsageCb = async (
    lastMessage: Message | undefined,
    finalGeneration: { usage: LanguageModelUsage; providerMetadata?: ProviderMetadata },
  ) => {
    if (!userApiKey) {
      await recordUsage(
        PROVISION_HOST,
        token,
        body.modelProvider,
        teamSlug,
        deploymentName,
        lastMessage,
        finalGeneration,
      );
    }
  };

  try {
    const totalMessageContent = messages.reduce((acc, message) => acc + message.content, '');
    logger.debug(`Total message length: ${totalMessageContent.split(' ').length}, words`);
    const dataStream = await convexAgent({
      chatInitialId,
      firstUserMessage,
      messages,
      tracer,
      modelProvider: body.modelProvider,
      // Only set the requested model choice if we're using a user API key.
      modelChoice: userApiKey ? body.modelChoice : undefined,
      userApiKey,
      shouldDisableTools: body.shouldDisableTools,
      skipSystemPrompt: body.skipSystemPrompt,
      smallFiles: body.smallFiles,
      recordUsageCb,
      recordRawPromptsForDebugging: !!recordRawPromptsForDebugging,
      collapsedMessages: body.collapsedMessages,
    });

    return new Response(dataStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache',
        'Text-Encoding': 'chunked',
      },
    });
  } catch (error: any) {
    logger.error(error);

    if (error.message?.includes('API key')) {
      throw new Response('Invalid or missing API key', {
        status: 401,
        statusText: 'Unauthorized',
      });
    }

    throw new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
