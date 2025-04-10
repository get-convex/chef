import { internalMutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getChat, getChatByIdOrUrlIdEnsuringAccess } from './messages';

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
  },
});

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
