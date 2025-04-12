import { httpRouter } from 'convex/server';
import { httpAction, type ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { ConvexError } from 'convex/values';
import { openaiProxy } from './openaiProxy';
import { corsRouter, DEFAULT_EXPOSED_HEADERS } from 'convex-helpers/server/cors';

const http = httpRouter();
const httpWithCors = corsRouter(http, {
  exposedHeaders: [...DEFAULT_EXPOSED_HEADERS, 'X-ConvexChef-Compression'],
});

// This is particularly useful with CORS, where an unhandled error won't have CORS
// headers applied to it.
function httpActionWithErrorHandling(handler: (ctx: ActionCtx, request: Request) => Promise<Response>) {
  return httpAction(async (ctx, request) => {
    try {
      return await handler(ctx, request);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: e instanceof ConvexError ? e.message : 'An unknown error occurred' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
  });
}
httpWithCors.route({
  path: '/upload_snapshot',
  method: 'POST',
  handler: httpActionWithErrorHandling(async (ctx, request) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) {
      throw new ConvexError('sessionId is required');
    }
    const chatId = url.searchParams.get('chatId');
    if (!chatId) {
      throw new ConvexError('chatId is required');
    }

    const blob = await request.blob();
    const storageId = await ctx.storage.store(blob);

    await ctx.runMutation(internal.snapshot.saveSnapshot, {
      sessionId: sessionId as Id<'sessions'>,
      chatId: chatId as Id<'chats'>,
      storageId,
    });

    return new Response(JSON.stringify({ snapshotId: storageId }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }),
});

http.route({
  pathPrefix: '/openai-proxy/',
  method: 'POST',
  handler: openaiProxy,
});

httpWithCors.route({
  path: '/initial_messages',
  method: 'POST',
  handler: httpActionWithErrorHandling(async (ctx, request) => {
    const body = await request.json();
    const sessionId = body.sessionId;
    const chatId = body.chatId;
    if (!sessionId) {
      throw new ConvexError('sessionId is required');
    }
    if (!chatId) {
      throw new ConvexError('chatId is required');
    }
    const storageInfo = await ctx.runQuery(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
    });
    if (storageInfo) {
      if (!storageInfo.storageId) {
        return new Response(null, {
          status: 204,
        });
      }
      const blob = await ctx.storage.get(storageInfo.storageId);
      return new Response(blob, {
        status: 200,
        headers: {
          'X-ConvexChef-Compression': storageInfo.compression,
        },
      });
    } else {
      const messages = await ctx.runQuery(internal.messages.getInitialMessagesInternal, {
        sessionId,
        id: chatId,
      });
      if (messages.length === 0) {
        // No content
        return new Response(null, {
          status: 204,
        });
      }
      const text = JSON.stringify(messages);
      const storageId = await ctx.storage.store(new Blob([text]));
      await ctx.runMutation(internal.messages.handleStorageStateMigration, {
        sessionId,
        chatId,
        storageId,
        lastMessageRank: messages.length - 1,
        partIndex: (messages.at(-1)?.parts?.length ?? 0) - 1,
      });
      const blob = await ctx.storage.get(storageId);
      return new Response(blob, {
        status: 200,
        headers: {
          'X-ConvexChef-Compression': 'none',
        },
      });
    }
  }),
});

httpWithCors.route({
  path: '/store_messages',
  method: 'POST',
  handler: httpActionWithErrorHandling(async (ctx, request) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    const chatId = url.searchParams.get('chatId');
    const lastMessageRank = url.searchParams.get('lastMessageRank');
    const partIndex = url.searchParams.get('partIndex');
    const blob = await request.blob();
    const storageId = await ctx.storage.store(blob);
    await ctx.runMutation(internal.messages.updateStorageState, {
      sessionId: sessionId as Id<'sessions'>,
      chatId: chatId as Id<'chats'>,
      lastMessageRank: parseInt(lastMessageRank!),
      partIndex: parseInt(partIndex!),
      storageId,
    });
    return new Response(null, {
      status: 200,
    });
  }),
});

export default httpWithCors.http;
