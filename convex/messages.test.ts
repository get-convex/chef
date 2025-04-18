import { expect, test, vi } from 'vitest';
import { api, internal } from './_generated/api';
import { createChat, setupTest, storeMessages, storeChat, type TestConvex, verifyStoredContent } from './test.setup';
import { getChatByIdOrUrlIdEnsuringAccess, type SerializedMessage } from './messages';
import type { Id } from './_generated/dataModel';
import { v } from 'convex/values';
import { type GenericMutationCtx } from 'convex/server';

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

test('store chat with snapshot', async () => {
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

  // Verify initial content
  if (!initialMessagesStorageInfo?.storageId) throw new Error('No storage ID');
  if (!initialMessagesStorageInfo?.snapshotId) throw new Error('No snapshot ID');
  await verifyStoredContent(t, initialMessagesStorageInfo.storageId, JSON.stringify([firstMessage]));
  await verifyStoredContent(t, initialMessagesStorageInfo.snapshotId, initialSnapshotContent);

  // Store second message without snapshot - should keep the old snapshot ID
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
  expect(nextMessagesStorageInfo?.snapshotId).toBe(initialMessagesStorageInfo.snapshotId);
  expect(nextMessagesStorageInfo?.lastMessageRank).toBe(1);
  expect(nextMessagesStorageInfo?.partIndex).toBe(0);

  // Verify that messages were updated but snapshot remains the same
  if (!nextMessagesStorageInfo?.storageId) throw new Error('No storage ID');
  if (!nextMessagesStorageInfo?.snapshotId) throw new Error('No snapshot ID');
  await verifyStoredContent(t, nextMessagesStorageInfo.storageId, JSON.stringify([firstMessage, secondMessage]));
  await verifyStoredContent(t, nextMessagesStorageInfo.snapshotId, initialSnapshotContent);

  // Store only a new snapshot - should keep the old storage ID
  const updatedSnapshotContent = 'updated snapshot';
  const updatedSnapshotBlob = new Blob([updatedSnapshotContent]);
  await storeChat(t, chatId, sessionId, {
    snapshot: updatedSnapshotBlob,
    messages: [firstMessage, secondMessage],
    doNotUpdateMessages: true,
  });

  const finalMessagesStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
    sessionId,
    chatId,
  });
  expect(finalMessagesStorageInfo).not.toBeNull();
  expect(finalMessagesStorageInfo?.storageId).toBe(nextMessagesStorageInfo.storageId);
  expect(finalMessagesStorageInfo?.snapshotId).not.toBe(nextMessagesStorageInfo.snapshotId);
  expect(finalMessagesStorageInfo?.lastMessageRank).toBe(1);
  expect(finalMessagesStorageInfo?.partIndex).toBe(0);

  // Verify that messages remain the same but snapshot is updated
  if (!finalMessagesStorageInfo?.storageId) throw new Error('No storage ID');
  if (!finalMessagesStorageInfo?.snapshotId) throw new Error('No snapshot ID');
  await verifyStoredContent(t, finalMessagesStorageInfo.storageId, JSON.stringify([firstMessage, secondMessage]));
  await verifyStoredContent(t, finalMessagesStorageInfo.snapshotId, updatedSnapshotContent);

  // Should have all states in the table
  const allChatMessagesStorageStates = await t.run(async (ctx) => {
    const chatMessagesStorageState = await ctx.db
      .query('chatMessagesStorageState')
      .withIndex('byStorageId', (q) => q.eq('storageId', finalMessagesStorageInfo?.storageId as Id<'_storage'>))
      .first();
    if (!chatMessagesStorageState) {
      throw new Error('chatMessagesStorageState not found');
    }
    return ctx.db
      .query('chatMessagesStorageState')
      .withIndex('byChatId', (q) => q.eq('chatId', chatMessagesStorageState?.chatId))
      .collect();
  });
  // Initialize chat record, first message with snapshot, second message with old snapshot that later gets updated
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

test('sending message after rewind deletes future records when no share exists', async () => {
  vi.useFakeTimers();
  const t = setupTest();
  const { sessionId, chatId } = await createChat(t);

  // Store first message with snapshot
  const firstMessage: SerializedMessage = {
    id: '1',
    role: 'user',
    parts: [{ text: 'Hello, world!', type: 'text' }],
    createdAt: Date.now(),
  };
  const initialSnapshotContent = 'initial snapshot';
  await storeChat(t, chatId, sessionId, {
    messages: [firstMessage],
    snapshot: new Blob([initialSnapshotContent]),
  });

  // Store second message with updated snapshot
  const secondMessage: SerializedMessage = {
    id: '2',
    role: 'assistant',
    parts: [{ text: 'Hi there!', type: 'text' }],
    createdAt: Date.now(),
  };
  const updatedSnapshotContent = 'updated snapshot';
  await storeChat(t, chatId, sessionId, {
    messages: [firstMessage, secondMessage],
    snapshot: new Blob([updatedSnapshotContent]),
  });

  // Get the storage info before rewinding
  const preRewindInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
    sessionId,
    chatId,
  });
  expect(preRewindInfo).not.toBeNull();
  if (!preRewindInfo?.storageId) throw new Error('No storage ID');
  if (!preRewindInfo?.snapshotId) throw new Error('No snapshot ID');
  const preRewindStorageId = preRewindInfo.storageId;
  const preRewindSnapshotId = preRewindInfo.snapshotId;

  // Rewind to first message
  await t.mutation(api.messages.rewindChat, { sessionId, chatId, lastMessageRank: 0 });

  // Send a new message after rewinding
  const newMessage: SerializedMessage = {
    id: '3',
    role: 'user',
    parts: [{ text: 'New direction!', type: 'text' }],
    createdAt: Date.now(),
  };
  const newSnapshotContent = 'new snapshot';
  await storeChat(t, chatId, sessionId, {
    messages: [firstMessage, newMessage],
    snapshot: new Blob([newSnapshotContent]),
  });

  // Verify that the old storage and snapshot blobs are deleted
  await t.run(async (ctx) => {
    const oldStorageBlob = await ctx.storage.get(preRewindStorageId);
    const oldSnapshotBlob = await ctx.storage.get(preRewindSnapshotId);
    expect(oldStorageBlob).toBeNull();
    expect(oldSnapshotBlob).toBeNull();
  });

  // Verify that old storage states are deleted
  const finalStorageStates = await t.run(async (ctx) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    if (!chat) throw new Error('Chat not found');
    return ctx.db
      .query('chatMessagesStorageState')
      .withIndex('byChatId', (q) => q.eq('chatId', chat._id))
      .collect();
  });
  // Should only have: initialize chat, first message, and new message states
  expect(finalStorageStates.length).toBe(3);

  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  vi.useRealTimers();
});

test('sending message after rewind preserves future records when share exists', async () => {
  vi.useFakeTimers();
  const t = setupTest();
  const { sessionId, chatId } = await createChat(t);

  // Store first message with snapshot
  const firstMessage: SerializedMessage = {
    id: '1',
    role: 'user',
    parts: [{ text: 'Hello, world!', type: 'text' }],
    createdAt: Date.now(),
  };
  const initialSnapshotContent = 'initial snapshot';
  await storeChat(t, chatId, sessionId, {
    messages: [firstMessage],
    snapshot: new Blob([initialSnapshotContent]),
  });

  // Store second message with updated snapshot
  const secondMessage: SerializedMessage = {
    id: '2',
    role: 'assistant',
    parts: [{ text: 'Hi there!', type: 'text' }],
    createdAt: Date.now(),
  };
  const updatedSnapshotContent = 'updated snapshot';
  await storeChat(t, chatId, sessionId, {
    messages: [firstMessage, secondMessage],
    snapshot: new Blob([updatedSnapshotContent]),
  });

  // Create a share of the chat
  const { code } = await t.mutation(api.share.create, { sessionId, id: chatId });
  expect(code).toBeDefined();

  // Get the storage info before rewinding
  const preRewindInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
    sessionId,
    chatId,
  });
  expect(preRewindInfo).not.toBeNull();
  if (!preRewindInfo?.storageId) throw new Error('No storage ID');
  if (!preRewindInfo?.snapshotId) throw new Error('No snapshot ID');
  const preRewindStorageId = preRewindInfo.storageId;
  const preRewindSnapshotId = preRewindInfo.snapshotId;

  // Rewind to first message
  await t.mutation(api.messages.rewindChat, { sessionId, chatId, lastMessageRank: 0 });

  // Send a new message after rewinding
  const newMessage: SerializedMessage = {
    id: '3',
    role: 'user',
    parts: [{ text: 'New direction!', type: 'text' }],
    createdAt: Date.now(),
  };
  const newSnapshotContent = 'new snapshot';
  await storeChat(t, chatId, sessionId, {
    messages: [firstMessage, newMessage],
    snapshot: new Blob([newSnapshotContent]),
  });

  // Verify that the old storage and snapshot blobs still exist
  await t.run(async (ctx) => {
    const oldStorageBlob = await ctx.storage.get(preRewindStorageId);
    const oldSnapshotBlob = await ctx.storage.get(preRewindSnapshotId);
    expect(oldStorageBlob).not.toBeNull();
    expect(oldSnapshotBlob).not.toBeNull();

    if (oldStorageBlob) {
      const content = await oldStorageBlob.text();
      expect(JSON.parse(content)).toEqual([firstMessage, secondMessage]);
    }
    if (oldSnapshotBlob) {
      const content = await oldSnapshotBlob.text();
      expect(content).toBe(updatedSnapshotContent);
    }
  });

  const finalStorageStates = await t.run(async (ctx) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    if (!chat) throw new Error('Chat not found');
    return ctx.db
      .query('chatMessagesStorageState')
      .withIndex('byChatId', (q) => q.eq('chatId', chat._id))
      .collect();
  });
  // Should have: initialize chat, first message, and new message overriding the second message
  expect(finalStorageStates.length).toBe(3);
  const newestMessage = finalStorageStates[2];
  if (!newestMessage?.storageId) throw new Error('No storage ID');
  verifyStoredContent(t, newestMessage.storageId, JSON.stringify([firstMessage, newMessage]));

  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  vi.useRealTimers();
});

test('sending message after rewind preserves snapshots referenced by previous chatMessageStorageState', async () => {
  vi.useFakeTimers();
  const t = setupTest();
  const { sessionId, chatId } = await createChat(t);

  // Store first message with snapshot
  const firstMessage: SerializedMessage = {
    id: '1',
    role: 'user',
    parts: [{ text: 'Hello, world!', type: 'text' }],
    createdAt: Date.now(),
  };
  const sharedSnapshotContent = 'shared snapshot content';
  await storeChat(t, chatId, sessionId, {
    messages: [firstMessage],
    snapshot: new Blob([sharedSnapshotContent]),
  });

  // Get the first storage state to verify its snapshot later
  const firstStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
    sessionId,
    chatId,
  });
  expect(firstStorageInfo).not.toBeNull();
  expect(firstStorageInfo?.snapshotId).not.toBeNull();
  const sharedSnapshotId = firstStorageInfo?.snapshotId;

  // Store second message with the same snapshot (using doNotUpdateMessages to keep the snapshot reference)
  const secondMessage: SerializedMessage = {
    id: '2',
    role: 'assistant',
    parts: [{ text: 'Hi there!', type: 'text' }],
    createdAt: Date.now(),
  };
  await storeChat(t, chatId, sessionId, {
    messages: [firstMessage, secondMessage],
  });

  // Verify both states have the same snapshot ID
  const secondStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
    sessionId,
    chatId,
  });
  expect(secondStorageInfo).not.toBeNull();
  expect(secondStorageInfo?.snapshotId).toBe(sharedSnapshotId);

  // Rewind to first message
  await t.mutation(api.messages.rewindChat, { sessionId, chatId, lastMessageRank: 0 });

  // Send a new message with a different snapshot
  const newMessage: SerializedMessage = {
    id: '3',
    role: 'user',
    parts: [{ text: 'New direction!', type: 'text' }],
    createdAt: Date.now(),
  };
  const newSnapshotContent = 'new snapshot content';
  await storeChat(t, chatId, sessionId, {
    messages: [firstMessage, newMessage],
    snapshot: new Blob([newSnapshotContent]),
  });

  // Verify the shared snapshot still exists and contains the original content
  await t.run(async (ctx) => {
    if (!sharedSnapshotId) throw new Error('No shared snapshot ID');
    const sharedSnapshotBlob = await ctx.storage.get(sharedSnapshotId);
    expect(sharedSnapshotBlob).not.toBeNull();
    if (!sharedSnapshotBlob) throw new Error('Shared snapshot was deleted');
    const content = await sharedSnapshotBlob.text();
    expect(content).toBe(sharedSnapshotContent);
  });

  // Verify we have the expected number of storage states
  const finalStorageStates = await t.run(async (ctx) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    if (!chat) throw new Error('Chat not found');
    return ctx.db
      .query('chatMessagesStorageState')
      .withIndex('byChatId', (q) => q.eq('chatId', chat._id))
      .collect();
  });
  // Should have: initialize chat, first message, and new message states
  expect(finalStorageStates.length).toBe(3);

  // Verify the newest message has the new snapshot content
  const newestMessage = finalStorageStates[2];
  if (!newestMessage?.snapshotId) throw new Error('No snapshot ID');
  await verifyStoredContent(t, newestMessage.snapshotId, newSnapshotContent);

  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  vi.useRealTimers();
});
