import { internalAction, internalMutation, query, type MutationCtx } from './_generated/server';
import { v } from 'convex/values';
import { getChat, getChatByIdOrUrlIdEnsuringAccess } from './messages';
import type { Id } from './_generated/dataModel';
import { internal } from './_generated/api';

// Save the snapshot information after successful upload
export const saveSnapshot = internalMutation({
  args: {
    sessionId: v.id('sessions'),
    chatId: v.string(),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, { sessionId, chatId, storageId }) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });

    if (!chat) {
      throw new Error('Chat not found');
    }
    await ctx.db.patch(chat._id, {
      snapshotId: storageId,
    });

    // Delete the prior snapshot only if it is not being used by another chat or share
    if (chat.snapshotId) {
      await deleteUnreferencedSnapshot(ctx, chat.snapshotId);
    }
  },
});

async function deleteUnreferencedSnapshot(ctx: MutationCtx, snapshotId: Id<'_storage'>) {
  const firstShareWithSnapshot = await ctx.db
    .query('shares')
    .withIndex('bySnapshotId', (q) => q.eq('snapshotId', snapshotId))
    .first();
  const firstChatWithSnapshot = await ctx.db
    .query('chats')
    .withIndex('bySnapshotId', (q) => q.eq('snapshotId', snapshotId))
    .first();
  if (firstShareWithSnapshot === null && firstChatWithSnapshot === null) {
    await ctx.storage.delete(snapshotId);
  }
}

export const getSnapshotUrl = query({
  args: {
    sessionId: v.id('sessions'),
    chatId: v.string(),
  },
  handler: async (ctx, { sessionId, chatId }) => {
    const chat = await getChat(ctx, chatId, sessionId);

    const snapshotId = chat?.snapshotId;
    if (!snapshotId) {
      return null;
    }
    const snapshot = await ctx.storage.getUrl(snapshotId);
    if (!snapshot) {
      throw new Error(`Expected to find a storageUrl for snapshot with id ${snapshotId}`);
    }
    return snapshot;
  },
});

export const deleteAllUnreferencedSnapshots = internalAction({
  args: { batchSize: v.number() },
  handler: async (ctx, { batchSize }) => {
    let cursor = null;
    while (true) {
      cursor = await ctx.runMutation(internal.snapshot.deleteSnapshotsIfUnreferenced, {
        batchSize,
        cursor,
      });
      if (cursor === null) {
        break;
      }
    }
  },
});

// Walk over the storage table, deleting unreferenced snapshots
export const deleteSnapshotsIfUnreferenced = internalMutation({
  args: { batchSize: v.number(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { batchSize, cursor }) => {
    const files = await ctx.db.system.query('_storage').paginate({ numItems: batchSize, cursor });
    for (const { _id: storageId } of files.page) {
      await deleteUnreferencedSnapshot(ctx, storageId);
    }
    if (files.isDone) {
      return null;
    }
    return files.continueCursor;
  },
});
