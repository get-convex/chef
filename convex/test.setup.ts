import { convexTest, type TestConvexForDataModel } from 'convex-test';
import schema from './schema';
import { api } from './_generated/api';
import { compressMessages } from './compressMessages';
import type { SerializedMessage } from './messages';

// TODO -- for some reason, parameterizing on the generated `DataModel` does not work
export type TestConvex = TestConvexForDataModel<any>;

// Polyfill for Web Crypto API used in storage calls
if (typeof globalThis.crypto === 'undefined') {
  const { webcrypto } = await import('node:crypto');
  globalThis.crypto = webcrypto as unknown as Crypto;
}

export const modules = import.meta.glob('../convex/**/*.*s');

export function setupTest() {
  const test = convexTest(schema, modules);
  const t = test.withIdentity({ name: 'Emma' });
  return t;
}

export async function createChat(t: TestConvex) {
  const sessionId = await t.mutation(api.sessions.startSession);
  const chatId = 'test';
  await t.mutation(api.messages.initializeChat, {
    id: chatId,
    sessionId,
    projectInitParams: testProjectInitParams,
  });
  return { sessionId, chatId };
}

export const testProjectInitParams = {
  teamSlug: 'test',
  auth0AccessToken: 'test',
};

export async function storeMessages(t: TestConvex, chatId: string, sessionId: string, messages: SerializedMessage[]) {
  const compressedMessages = await compressMessages(messages);
  const url = new URL('/store_messages', 'http://localhost:3000');
  url.searchParams.set('sessionId', sessionId);
  url.searchParams.set('chatId', chatId);
  url.searchParams.set('lastMessageRank', (messages.length - 1).toString());
  url.searchParams.set('partIndex', ((messages.at(-1)?.parts?.length ?? 0) - 1).toString());
  await t.fetch(url.pathname + url.search, {
    method: 'POST',
    body: new Blob([compressedMessages]),
  });
}

export async function storeChat(
  t: TestConvex,
  chatId: string,
  sessionId: string,
  args: {
    messages?: SerializedMessage[];
    snapshot?: Blob;
  },
) {
  const formData = new FormData();
  if (args.messages) {
    formData.append('messages', new Blob([JSON.stringify(args.messages)]));
  }
  if (args.snapshot) {
    formData.append('snapshot', args.snapshot);
  }

  const url = new URL('/store_chat', 'http://localhost:3000');
  url.searchParams.set('sessionId', sessionId);
  url.searchParams.set('chatId', chatId);
  if (args.messages) {
    url.searchParams.set('lastMessageRank', (args.messages.length - 1).toString());
    url.searchParams.set('partIndex', ((args.messages.at(-1)?.parts?.length ?? 0) - 1).toString());
  }

  await t.fetch(url.pathname + url.search, {
    method: 'POST',
    body: formData,
  });
}
