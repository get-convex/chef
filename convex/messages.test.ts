import { expect, test, vi } from 'vitest';
import { api, internal } from './_generated/api';
import { createChat, setupTest, storeMessages, storeChat, type TestConvex } from './test.setup';
import type { SerializedMessage } from './messages';
import type { Id } from './_generated/dataModel';
import { v } from 'convex/values';
import { type GenericMutationCtx } from 'convex/server';

const storageInfoWithSnapshot = v.object({
  storageId: v.union(v.id('_storage'), v.null()),
  lastMessageRank: v.number(),
  partIndex: v.number(),
  snapshotId: v.optional(v.id('_storage')),
});

async function verifyStoredContent(t: TestConvex, snapshotId: Id<'_storage'>, expectedContent: string) {
  await t.run(
    async (ctx: GenericMutationCtx<any> & { storage: { get: (id: Id<'_storage'>) => Promise<Blob | null> } }) => {
      const blob = await ctx.storage.get(snapshotId);
      if (!blob) throw new Error('Failed to retrieve snapshot');
      const content = await blob.text();
      expect(content).toBe(expectedContent);
    },
  );
}

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

test('store chat without snapshot', async () => {
  vi.useFakeTimers();
  const t = setupTest();
  const { sessionId, chatId } = await createChat(t);

  const firstMessage: SerializedMessage = {
    id: '1',
    role: 'user',
    parts: [{ text: 'Hello, world!', type: 'text' }],
    createdAt: Date.now(),
  };

  await storeChat(t, chatId, sessionId, {
    messages: [firstMessage],
  });

  const initialMessagesStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
    sessionId,
    chatId,
  });
  expect(initialMessagesStorageInfo).not.toBeNull();
  expect(initialMessagesStorageInfo?.storageId).not.toBeNull();
  expect(initialMessagesStorageInfo?.snapshotId).toBeUndefined();
  expect(initialMessagesStorageInfo?.lastMessageRank).toBe(0);
  expect(initialMessagesStorageInfo?.partIndex).toBe(0);

  // Verify initial message content
  if (!initialMessagesStorageInfo?.storageId) throw new Error('No storage ID');
  await verifyStoredContent(t, initialMessagesStorageInfo.storageId, JSON.stringify([firstMessage]));

  const secondMessage: SerializedMessage = {
    id: '2',
    role: 'assistant',
    parts: [{ text: 'How can I help you today?', type: 'text' }],
    createdAt: Date.now(),
  };

  await storeChat(t, chatId, sessionId, {
    messages: [firstMessage, secondMessage],
  });

  const nextMessagesStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
    sessionId,
    chatId,
  });
  expect(nextMessagesStorageInfo).not.toBeNull();
  expect(nextMessagesStorageInfo?.storageId).not.toBeNull();
  expect(nextMessagesStorageInfo?.snapshotId).toBeUndefined();
  expect(nextMessagesStorageInfo?.lastMessageRank).toBe(1);
  expect(nextMessagesStorageInfo?.partIndex).toBe(0);

  // Verify updated message content
  if (!nextMessagesStorageInfo?.storageId) throw new Error('No storage ID');
  await verifyStoredContent(t, nextMessagesStorageInfo.storageId, JSON.stringify([firstMessage, secondMessage]));

  // Should still have both message states in the table
  const allChatMessagesStorageStates = await t.run(async (ctx) => {
    const chatMessagesStorageState = await ctx.db
      .query('chatMessagesStorageState')
      .withIndex('byStorageId', (q) => q.eq('storageId', nextMessagesStorageInfo?.storageId as Id<'_storage'>))
      .first();
    if (!chatMessagesStorageState) {
      throw new Error('chatMessagesStorageState not found');
    }
    return ctx.db
      .query('chatMessagesStorageState')
      .withIndex('byChatId', (q) => q.eq('chatId', chatMessagesStorageState?.chatId))
      .collect();
  });
  // Initialize chat record and two message states
  expect(allChatMessagesStorageStates.length).toBe(3);

  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  vi.useRealTimers();
});

test('rewind chat with snapshot', async () => {
  vi.useFakeTimers();
  const t = setupTest();
  const { sessionId, chatId } = await createChat(t);
  const firstMessage: SerializedMessage = {
    id: '1',
    role: 'user',
    parts: [{ text: 'Hello, world!', type: 'text' }],
    createdAt: Date.now(),
  };

  const initialSnapshotContent = 'initial snapshot';
  const snapshotBlob = new Blob([initialSnapshotContent]);
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

  // Verify initial snapshot content
  if (!initialMessagesStorageInfo?.snapshotId) throw new Error('No snapshot ID');
  await verifyStoredContent(t, initialMessagesStorageInfo.snapshotId, initialSnapshotContent);

  const secondMessage: SerializedMessage = {
    id: '2',
    role: 'user',
    parts: [{ text: 'foobar', type: 'text' }],
    createdAt: Date.now(),
  };

  const updatedSnapshotContent = 'updated snapshot';
  const updatedSnapshotBlob = new Blob([updatedSnapshotContent]);
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

  // Verify updated snapshot content
  if (!nextMessagesStorageInfo?.snapshotId) throw new Error('No snapshot ID');
  await verifyStoredContent(t, nextMessagesStorageInfo.snapshotId, updatedSnapshotContent);

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

  // Verify that after rewind we're back to the initial snapshot
  if (!rewoundMessagesStorageInfo?.snapshotId) throw new Error('No snapshot ID');
  await verifyStoredContent(t, rewoundMessagesStorageInfo.snapshotId, initialSnapshotContent);

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
