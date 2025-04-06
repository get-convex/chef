import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import type { Messages } from '~/lib/.server/llm/stream-text';
import { createScopedLogger } from '~/utils/logger';
import { convexAgent, getEnv } from '~/lib/.server/llm/convex-agent';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web';

const logger = createScopedLogger('api.chat');

export async function action(args: ActionFunctionArgs) {
  return chatAction(args, args.context.cloudflare.env);
}

export type Tracer = ReturnType<typeof WebTracerProvider.prototype.getTracer>;

async function chatAction({ request }: ActionFunctionArgs, env: Env) {
  const AXIOM_API_TOKEN = getEnv(env, 'AXIOM_API_TOKEN');
  const AXIOM_API_URL = getEnv(env, 'AXIOM_API_URL');
  const AXIOM_DATASET_NAME = getEnv(env, 'AXIOM_DATASET_NAME');
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

  const body = await request.json<{ messages: Messages; firstUserMessage: boolean; chatId: string }>();
  const { messages, firstUserMessage, chatId } = body;
  try {
    const totalMessageContent = messages.reduce((acc, message) => acc + message.content, '');
    logger.debug(`Total message length: ${totalMessageContent.split(' ').length}, words`);

    const dataStream = await convexAgent(chatId, env, firstUserMessage, messages, tracer);
    // Cloudflare expects binary data in its streams.
    const encoder = new TextEncoder();
    const binaryStream = dataStream.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          const toSerialize = typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
          const binary = encoder.encode(toSerialize);
          controller.enqueue(binary);
        },
      }),
    );
    return new Response(binaryStream, {
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
