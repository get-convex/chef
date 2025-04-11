import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { modules } from './test.setup';

test('sending messages', async () => {
  const test = convexTest(schema, modules);
  const t = test.withIdentity({ name: 'Sarah' });

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
  const chats = await t.query(api.messages.getAll, {
    sessionId,
  });
  expect(chats.length).toBe(1);
  const chat = chats[0];
  expect(chat.id).toBe(chatId);
  expect(chat.initialId).toBe(chatId);
  expect(chat.urlId).toBeUndefined();
  expect(chat.description).toBeUndefined();
  expect(chat.timestamp).toBeDefined();
});
