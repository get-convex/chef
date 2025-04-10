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

    const code = await generateUniqueCode(ctx.db);

    const snapshotId = '' as Id<'_storage'>; // TODO Fix this

    await ctx.db.insert('shareLinks', { chatId: chat._id, snapshotId, code });

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
