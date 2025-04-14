import { expect, test } from 'vitest';
import { api, internal } from './_generated/api';
import { createChat, setupTest } from './test.setup';

test('sharing a chat fails if there is no snapshot', async () => {
  const t = setupTest();
  const { sessionId } = await createChat(t);
  await expect(t.mutation(api.share.create, { sessionId, id: 'test' })).rejects.toThrow(
    'Your project has never been saved.',
  );
});

test('sharing a chat works if there is a snapshot', async () => {
  const t = setupTest();
  const { sessionId, chatId } = await createChat(t);
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob(['Hello, world!'])));
  await t.mutation(internal.snapshot.saveSnapshot, {
    sessionId,
    chatId,
    storageId,
  });
  const code = await t.mutation(api.share.create, { sessionId, id: 'test' });
  expect(code).toBeDefined();
});

// TODO: Test that cloning messages does not leak a more recent snapshot or later messages