import { httpRouter } from 'convex/server';
import { action, httpAction, type ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { ConvexError } from 'convex/values';
import { openaiProxy } from './openaiProxy';
import { corsRouter } from 'convex-helpers/server/cors';

const http = httpRouter();
const httpWithCors = corsRouter(http);

httpWithCors.route({
  path: '/upload_snapshot',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    let storageId: Id<'_storage'>;
    try {
      storageId = await uploadSnapshot(ctx, request);
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

    return new Response(JSON.stringify({ snapshotId: storageId }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }),
});

async function uploadSnapshot(ctx: ActionCtx, request: Request): Promise<Id<'_storage'>> {
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
  return storageId;
}

http.route({
  pathPrefix: '/openai-proxy/',
  method: 'POST',
  handler: openaiProxy,
});

httpWithCors.route({
  path: '/initial_messages',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
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
      const blob = await ctx.storage.get(storageInfo.storageId);
      return new Response(blob, {
        status: 200,
      });
    } else {
      // No content
      return new Response(null, {
        status: 204,
      });
    }
  }),
});

httpWithCors.route({
  path: '/store_messages',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    const chatId = url.searchParams.get('chatId');
    const lastMessageRank = url.searchParams.get('lastMessageRank');
    const lastPartRank = url.searchParams.get('lastPartRank');
    const blob = await request.blob();
    const storageId = await ctx.storage.store(blob);
    await ctx.runMutation(internal.messages.updateStorageState, {
      sessionId: sessionId as Id<'sessions'>,
      chatId,
      lastMessageRank: parseInt(lastMessageRank!),
      partIndex: parseInt(lastPartRank!),
      storageId,
    });
    return new Response(null, {
      status: 200,
    });
  }),
});

export default httpWithCors.http;
