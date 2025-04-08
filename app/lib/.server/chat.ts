import { type ActionFunctionArgs } from '@vercel/remix';
import { createScopedLogger } from '~/utils/logger';
import { convexAgent, getEnv } from '~/lib/.server/llm/convex-agent';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import type { LanguageModelUsage, Message } from 'ai';
import { checkTokenUsage, recordUsage } from '~/lib/.server/usage';

type Messages = Message[];

const logger = createScopedLogger('api.chat');

export type Tracer = ReturnType<typeof WebTracerProvider.prototype.getTracer>;

export async function chatAction({ request }: ActionFunctionArgs) {
  const env = globalThis.process.env;
  const AXIOM_API_TOKEN = getEnv(env, 'AXIOM_API_TOKEN');
  const AXIOM_API_URL = getEnv(env, 'AXIOM_API_URL');
  const AXIOM_DATASET_NAME = getEnv(env, 'AXIOM_DATASET_NAME');
  const PROVISION_HOST = getEnv(env, 'PROVISION_HOST') || 'https://api.convex.dev';
  // TODO(nipunn) - enable rate limiting before launch
  // keeping it off for now to avoid ratelimiting our early adopter testers
  // until we have full entitlements grants in place.
  const enableRateLimiting = getEnv(env, 'ENABLE_RATE_LIMITING');

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
    chatId: string;
    token: string;
    teamSlug: string;
    deploymentName: string | undefined;
  };
  const { messages, firstUserMessage, chatId, deploymentName, token, teamSlug } = body;

  if (enableRateLimiting) {
    const resp = await checkTokenUsage(PROVISION_HOST, token, teamSlug, deploymentName);
    if (resp) {
      return resp;
    }
  }

  const recordUsageCb = async (usage: LanguageModelUsage) => {
    if (enableRateLimiting) {
      await recordUsage(PROVISION_HOST, token, teamSlug, deploymentName, usage);
    }
  };

  try {
    const totalMessageContent = messages.reduce((acc, message) => acc + message.content, '');
    logger.debug(`Total message length: ${totalMessageContent.split(' ').length}, words`);
    const dataStream = await convexAgent(chatId, env, firstUserMessage, messages, tracer, recordUsageCb);

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
