import { expect, test } from 'vitest';
import { api } from './_generated/api';
import { createChat, setupTest } from './test.setup';

test('sending messages', async () => {
  const t = setupTest();
  const { sessionId, chatId } = await createChat(t);

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
