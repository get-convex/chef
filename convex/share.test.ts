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

test('unreferenced snapshots are deleted', async () => {
  const t = setupTest();
  const { sessionId, chatId } = await createChat(t);
  const storageId1 = await t.run((ctx) => ctx.storage.store(new Blob(['Hello, world!'])));
  await t.mutation(internal.snapshot.saveSnapshot, { sessionId, chatId, storageId: storageId1 });
  const storageId2 = await t.run((ctx) => ctx.storage.store(new Blob(['foobar'])));
  await t.mutation(internal.snapshot.saveSnapshot, { sessionId, chatId, storageId: storageId2 });
  // `storageId1` should be deleted because it was overwritten by `storageId2`
  await expect(t.run((ctx) => ctx.storage.get(storageId1))).resolves.toBeNull();
  // `storageId2` should not be deleted
  const blob = await t.run(async (ctx) => {
    const blob = await ctx.storage.get(storageId2);
    return blob?.text();
  });
  expect(blob).toBe('foobar');
});

test('referenced snapshots are not deleted', async () => {
  const t = setupTest();
  const { sessionId, chatId } = await createChat(t);
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
