import { expect, test, vi } from 'vitest';
import { api, internal } from './_generated/api';
import { createChat, setupTest, storeMessages } from './test.setup';
import type { SerializedMessage } from './messages';

test('sending messages', async () => {
  vi.useFakeTimers();
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
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  vi.useRealTimers();
});

test('rewind chat', async () => {
  vi.useFakeTimers();
  const t = setupTest();
  const { sessionId, chatId } = await createChat(t);
  const firstMessage: SerializedMessage = {
    id: '1',
    role: 'user',
    parts: [{ text: 'Hello, world!', type: 'text' }],
    createdAt: Date.now(),
  };

  await storeMessages(t, chatId, sessionId, [firstMessage]);
  const initialMessagesStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
    sessionId,
    chatId,
  });
  expect(initialMessagesStorageInfo).not.toBeNull();
  expect(initialMessagesStorageInfo?.storageId).not.toBeNull();
  expect(initialMessagesStorageInfo?.lastMessageRank).toBe(0);
  expect(initialMessagesStorageInfo?.partIndex).toBe(0);
  const secondMessage: SerializedMessage = {
    id: '2',
    role: 'user',
    parts: [{ text: 'foobar', type: 'text' }],
    createdAt: Date.now(),
  };

  // Should see higher lastMessageRank after storing new messages
  await storeMessages(t, chatId, sessionId, [firstMessage, secondMessage]);
  const nextMessagesStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
    sessionId,
    chatId,
  });
  expect(nextMessagesStorageInfo).not.toBeNull();
  expect(nextMessagesStorageInfo?.storageId).not.toBeNull();
  expect(nextMessagesStorageInfo?.lastMessageRank).toBe(1);
  expect(nextMessagesStorageInfo?.partIndex).toBe(0);

  // Should see lower lastMessageRank after rewinding
  await t.mutation(api.messages.rewindChat, { sessionId, chatId, lastMessageRank: 0 });
  const rewoundMessagesStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
    sessionId,
    chatId,
  });
  expect(rewoundMessagesStorageInfo).not.toBeNull();
  expect(rewoundMessagesStorageInfo?.storageId).not.toBeNull();
  expect(rewoundMessagesStorageInfo?.lastMessageRank).toBe(0);
  expect(rewoundMessagesStorageInfo?.partIndex).toBe(0);

  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  vi.useRealTimers();
});

// TODO: Test that sending a message after rewinding deletes future records and their storage blobs iff there is no share.
// Share should use message storage blob because it may change with rewinds.
