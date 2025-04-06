import { httpRouter } from 'convex/server';
import { httpAction, type ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { ConvexError } from 'convex/values';
import { openaiProxy } from './openaiProxy';

const http = httpRouter();

http.route({
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
            'Access-Control-Allow-Origin': '*',
            Vary: 'Origin',
          },
        },
      );
    }

    return new Response(JSON.stringify({ snapshotId: storageId }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        Vary: 'Origin',
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
  path: '/upload_snapshot',
  method: 'OPTIONS',
  handler: httpAction(async () => {
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

http.route({
  pathPrefix: '/openai-proxy/',
  method: 'POST',
  handler: openaiProxy,
});

export default http;
