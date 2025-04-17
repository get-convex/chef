import { expect, test, vi } from 'vitest';
import { api, internal } from './_generated/api';
import { createChat, setupTest, storeMessages, storeChat } from './test.setup';
import type { SerializedMessage } from './messages';
import type { Id } from './_generated/dataModel';
import { v } from 'convex/values';

const storageInfoWithSnapshot = v.object({
  storageId: v.union(v.id('_storage'), v.null()),
  lastMessageRank: v.number(),
  partIndex: v.number(),
  snapshotId: v.optional(v.id('_storage')),
});

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

test('store messages', async () => {
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
  console.log('initialMessagesStorageInfo', initialMessagesStorageInfo);
  expect(initialMessagesStorageInfo).not.toBeNull();
  expect(initialMessagesStorageInfo?.storageId).not.toBeNull();
  expect(initialMessagesStorageInfo?.lastMessageRank).toBe(0);
  expect(initialMessagesStorageInfo?.partIndex).toBe(0);
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

  const snapshotBlob = new Blob(['initial snapshot']);
  await storeChat(t, chatId, sessionId, {
    messages: [firstMessage],
    snapshot: snapshotBlob,
  });

  const initialMessagesStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
    sessionId,
    chatId,
  });
  expect(initialMessagesStorageInfo).not.toBeNull();
  expect(initialMessagesStorageInfo?.storageId).not.toBeNull();
  expect(initialMessagesStorageInfo?.snapshotId).not.toBeNull();
  expect(initialMessagesStorageInfo?.lastMessageRank).toBe(0);
  expect(initialMessagesStorageInfo?.partIndex).toBe(0);

  const secondMessage: SerializedMessage = {
    id: '2',
    role: 'user',
    parts: [{ text: 'foobar', type: 'text' }],
    createdAt: Date.now(),
  };

  const updatedSnapshotBlob = new Blob(['updated snapshot']);
  await storeChat(t, chatId, sessionId, {
    messages: [firstMessage, secondMessage],
    snapshot: updatedSnapshotBlob,
  });

  const nextMessagesStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
    sessionId,
    chatId,
  });
  expect(nextMessagesStorageInfo).not.toBeNull();
  expect(nextMessagesStorageInfo?.storageId).not.toBeNull();
  expect(nextMessagesStorageInfo?.snapshotId).not.toBeNull();
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
  expect(rewoundMessagesStorageInfo?.snapshotId).not.toBeNull();
  expect(rewoundMessagesStorageInfo?.lastMessageRank).toBe(0);
  expect(rewoundMessagesStorageInfo?.partIndex).toBe(0);

  // Should still have higher lastMessageRank state in the table
  const allChatMessagesStorageStates = await t.run(async (ctx) => {
    const chatMessagesStorageState = await ctx.db
      .query('chatMessagesStorageState')
      .withIndex('byStorageId', (q) => q.eq('storageId', rewoundMessagesStorageInfo?.storageId as Id<'_storage'>))
      .first();
    if (!chatMessagesStorageState) {
      throw new Error('chatMessagesStorageState not found');
    }
    return ctx.db
      .query('chatMessagesStorageState')
      .withIndex('byChatId', (q) => q.eq('chatId', chatMessagesStorageState?.chatId))
      .collect();
  });
  // Initialize chat record, first message with snapshot, and second message with updated snapshot
  expect(allChatMessagesStorageStates.length).toBe(3);
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  vi.useRealTimers();
});

// TODO: Test that sending a message after rewinding deletes future records and their storage blobs iff there is no share.
// Share should use message storage blob because it may change with rewinds.
