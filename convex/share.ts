import { ConvexError, v } from 'convex/values';
import { mutation, type DatabaseReader } from './_generated/server';
import { getChatByIdOrUrlIdEnsuringAccess } from './messages';
import type { Id } from './_generated/dataModel';

export const create = mutation({
  args: {
    sessionId: v.id('sessions'),
    id: v.string(),
  },
  handler: async (ctx, { sessionId, id }) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id, sessionId });
    if (!chat) {
      throw new ConvexError('Chat not found');
    }

    if (!chat.snapshotId) {
      throw new ConvexError('Your project has never been saved.');
    }

    const lastMessage = await ctx.db
      .query('chatMessages')
      .withIndex('byChatId', (q) => q.eq('chatId', chat._id))
      .order('desc')
      .first();

    const code = await generateUniqueCode(ctx.db);

    await ctx.db.insert('shares', {
      chatId: chat._id,

      // It is safe to use the snapshotId from the chat because the user’s
      // snapshot excludes .env.local.
      snapshotId: chat.snapshotId,

      code,
      lastMessageRank: lastMessage ? lastMessage.rank : 0,
    });

    return { code };
  },
});

async function generateUniqueCode(db: DatabaseReader) {
  const code = crypto.randomUUID().replace(/-/g, '').substring(0, 6);
  const existing = await db
    .query('shareLinks')
    .withIndex('byCode', (q) => q.eq('code', code))
    .first();
  if (existing) {
    return generateUniqueCode(db);
  }
  return code;
}
