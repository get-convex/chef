import { ConvexError, v } from 'convex/values';
import { internalMutation, type DatabaseReader } from './_generated/server';
import { getChatByIdOrUrlIdEnsuringAccess } from './messages';

export const create = internalMutation({
  args: {
    sessionId: v.id('sessions'),
    chatId: v.id('chats'),
    snapshotId: v.id('_storage'),
  },
  handler: async (ctx, { sessionId, chatId, snapshotId }) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    if (!chat) {
      throw new ConvexError('Chat not found');
    }

    const code = await generateUniqueCode(ctx.db);

    await ctx.db.insert('shareLinks', { chatId, snapshotId, code });

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
