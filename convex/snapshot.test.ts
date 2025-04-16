import { expect, test } from 'vitest';
import { api, internal } from './_generated/api';
import { createChat, setupTest, storeMessages } from './test.setup';

test('referenced snapshots are not deleted', async () => {
  const t = setupTest();
  const { sessionId, chatId } = await createChat(t);
  await storeMessages(t, chatId, sessionId, [
    { id: '1', role: 'user', parts: [{ text: 'Hello, world!', type: 'text' }], createdAt: Date.now() },
  ]);
  const storageId1 = await t.run((ctx) => ctx.storage.store(new Blob(['Hello, world!'])));
  await t.mutation(internal.snapshot.saveSnapshot, { sessionId, chatId, storageId: storageId1 });

  await t.mutation(api.share.create, { sessionId, id: chatId });
  const storageId2 = await t.run((ctx) => ctx.storage.store(new Blob(['foobar'])));
  await t.mutation(internal.snapshot.saveSnapshot, { sessionId, chatId, storageId: storageId2 });

  // `storageId1` should not be deleted because it is referenced by the share
  const blob1 = await t.run(async (ctx) => {
    const blob = await ctx.storage.get(storageId1);
    return blob?.text();
  });
  expect(blob1).toBe('Hello, world!');

  // `storageId2` should not be deleted
  const blob2 = await t.run(async (ctx) => {
    const blob = await ctx.storage.get(storageId2);
    return blob?.text();
  });
  expect(blob2).toBe('foobar');
});
