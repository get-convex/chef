import { convexTest, type TestConvexForDataModel } from 'convex-test';
import schema from './schema';
import { api } from './_generated/api';

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

export async function createChat(t: TestConvexForDataModel<any>) {
  const sessionId = await t.mutation(api.sessions.startSession);
  const chatId = 'test';
  await t.mutation(api.messages.initializeChat, {
    id: chatId,
    sessionId,
    projectInitParams: {
      teamSlug: 'test',
      auth0AccessToken: 'test',
    },
  });
  return { sessionId, chatId };
}
