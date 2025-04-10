import { ConvexError, v } from 'convex/values';
import { internalMutation, type DatabaseReader } from './_generated/server';

export const create = internalMutation({
  args: {
    chatId: v.id('chats'),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, row) => {
    // FIXME: Add auth check

    // Verify that the chat exists
    const chat = await ctx.db.get(row.chatId);
    if (chat === null) {
      throw new ConvexError('Chat not found');
    }

    const code = await generateUniqueCode(ctx.db);

    await ctx.db.insert('shareLinks', { ...row, code });

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
