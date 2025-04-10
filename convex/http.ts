import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

const http = httpRouter();

http.route({
  path: '/upload_snapshot',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) {
      throw new Error('sessionId is required');
    }
    const chatId = url.searchParams.get('chatId');
    if (!chatId) {
      throw new Error('chatId is required');
    }

    const blob = await request.blob();
    const storageId = await ctx.storage.store(blob);

    const snapshotId = await ctx.runMutation(internal.snapshot.saveSnapshot, {
      sessionId: sessionId as Id<'sessions'>,
      chatId: chatId as Id<'chats'>,
      storageId,
    });

    return new Response(JSON.stringify({ snapshotId }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        Vary: 'Origin',
      },
    });
  }),
});

http.route({
  path: '/upload_snapshot',
  method: 'OPTIONS',
  handler: httpAction(async (ctx, request) => {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Digest',
        'Access-Control-Max-Age': '86400',
      },
    });
  }),
});

export default http;
