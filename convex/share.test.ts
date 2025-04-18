import { expect, test } from 'vitest';
import { api, internal } from './_generated/api';
import { createChat, setupTest, testProjectInitParams, storeMessages, type TestConvex } from './test.setup';
import type { SerializedMessage } from './messages';
import { decompressMessages } from './compressMessages';

test('sharing a chat fails if there is no snapshot', async () => {
  const t = setupTest();
  const { sessionId } = await createChat(t);
  await expect(t.mutation(api.share.create, { sessionId, id: 'test' })).rejects.toThrow(
    'Your project has never been saved.',
  );
});

async function initializeChat(t: TestConvex, initialMessage?: SerializedMessage) {
  const { sessionId, chatId } = await createChat(t);
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob(['Hello, world!'])));
  await t.mutation(internal.snapshot.saveSnapshot, {
    sessionId,
    chatId,
    storageId,
  });
  const firstMessage: SerializedMessage = {
    id: '1',
    role: 'user',
    parts: [{ text: 'Hello, world!', type: 'text' }],
    createdAt: Date.now(),
  };
  await storeMessages(t, chatId, sessionId, [initialMessage ?? firstMessage]);
  return { sessionId, chatId, snapshotId: storageId };
}

test('sharing a chat works if there is a snapshot + message', async () => {
  const t = setupTest();
  const { sessionId, chatId } = await initializeChat(t);
  const { code } = await t.mutation(api.share.create, { sessionId, id: chatId });
  expect(code).not.toBeNull();
});

test('getShareDescription works', async () => {
  const t = setupTest();
  const { sessionId, chatId } = await initializeChat(t);
  await t.mutation(api.messages.setUrlId, {
    sessionId,
    chatId,
    urlHint: 'test',
    description: 'This is a test chat',
  });
  const { code } = await t.mutation(api.share.create, { sessionId, id: 'test' });
  expect(code).not.toBeNull();
  const { description } = await t.query(api.share.getShareDescription, { code: code! });
  expect(description).toBe('This is a test chat');
});

test('cloning a chat forks history', async () => {
  const t = setupTest();
  const firstMessage: SerializedMessage = {
    id: '1',
    role: 'user',
    parts: [{ text: 'Hello, world!', type: 'text' }],
    createdAt: Date.now(),
  };
  const { sessionId, chatId } = await initializeChat(t, firstMessage);
  const { code } = await t.mutation(api.share.create, { sessionId, id: 'test' });
  expect(code).not.toBeNull();
  const { id: clonedChatId } = await t.mutation(api.share.clone, {
    sessionId,
    shareCode: code!,
    projectInitParams: testProjectInitParams,
  });
  expect(clonedChatId).toBeDefined();
  const response = await t.fetch('/initial_messages', {
    method: 'POST',
    body: JSON.stringify({
      chatId: clonedChatId,
      sessionId,
    }),
  });
  const secondMessage: SerializedMessage = {
    id: '2',
    role: 'assistant',
    parts: [{ text: 'Hi!', type: 'text' }],
    createdAt: Date.now(),
  };
  await storeMessages(t, chatId, sessionId, [firstMessage, secondMessage]);
  const decompressedMessages = await decompressMessages(response);
  expect(decompressedMessages.length).toBe(1);
  expect(decompressedMessages[0]).toMatchObject(firstMessage);
});

// TODO: Test that cloning messages does not leak a more recent snapshot or later messages
