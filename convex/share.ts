import { ConvexError, v } from 'convex/values';
import { internalAction, internalMutation, mutation, query, type DatabaseReader } from './_generated/server';
import { getChatByIdOrUrlIdEnsuringAccess, type SerializedMessage } from './messages';
import { startProvisionConvexProjectHelper } from './convexProjects';
import { internal } from './_generated/api';
import { compressMessages } from './compressMessages';

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

    const code = await generateUniqueCode(ctx.db);

    const storageState = await ctx.db
      .query('chatMessagesStorageState')
      .withIndex('byChatId', (q) => q.eq('chatId', chat._id))
      .first();

    if (storageState) {
      if (storageState.storageId === null) {
        throw new ConvexError('Chat history not found');
      }
      await ctx.db.insert('shares', {
        chatId: chat._id,

        // It is safe to use the snapshotId from the chat because the user’s
        // snapshot excludes .env.local.
        snapshotId: chat.snapshotId,

        chatHistoryId: storageState.storageId,

        code,
        lastMessageRank: storageState.lastMessageRank,
        partIndex: storageState.partIndex,
        description: chat.description,
      });
      return { code };
    } else {
      const messages = await ctx.db
        .query('chatMessages')
        .withIndex('byChatId', (q) => q.eq('chatId', chat._id))
        .order('desc')
        .collect();
      const compressedMessages = await compressMessages(messages.map((m) => m.content));
      const lastMessage = messages[messages.length - 1];
      const partIndex = ((lastMessage?.content as SerializedMessage)?.parts?.length ?? 0) - 1;
      await ctx.scheduler.runAfter(0, internal.share.intializeShareWithStorage, {
        shareFields: {
          chatId: chat._id,
          lastMessageRank: lastMessage?.rank ?? -1,
          partIndex,
          description: chat.description,
        },
        compressedMessages: compressedMessages.buffer,
      });
      return { code: null };
    }
  },
});

export const intializeShareWithStorage = internalAction({
  args: {
    shareFields: v.object({
      chatId: v.id('chats'),
      lastMessageRank: v.number(),
      partIndex: v.number(),
      description: v.optional(v.string()),
    }),
    compressedMessages: v.bytes(),
  },
  handler: async (ctx, { shareFields, compressedMessages }) => {
    const blob = new Blob([compressedMessages]);
    const storageId = await ctx.storage.store(blob);
    await ctx.runMutation(internal.share.updateShareWithStorage, {
      shareFields,
      storageId,
    });
  },
});

export const updateShareWithStorage = internalMutation({
  args: {
    shareFields: v.object({
      chatId: v.id('chats'),
      lastMessageRank: v.number(),
      partIndex: v.number(),
      description: v.optional(v.string()),
    }),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, { shareFields, storageId }) => {
    const code = await generateUniqueCode(ctx.db);
    await ctx.db.insert('shares', {
      chatId: shareFields.chatId,
      code,
      lastMessageRank: shareFields.lastMessageRank,
      partIndex: shareFields.partIndex,
      description: shareFields.description,
      chatHistoryId: storageId,
    });
  },
});

export const getCodeForChat = query({
  args: {
    chatId: v.string(),
    sessionId: v.id('sessions'),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { chatId, sessionId }) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    if (!chat) {
      return null;
    }
    const share = await ctx.db
      .query('shares')
      .withIndex('byChatId', (q) => q.eq('chatId', chat._id))
      .first();
    if (!share) {
      return null;
    }
    return share.code;
  },
});

async function generateUniqueCode(db: DatabaseReader) {
  const code = crypto.randomUUID().replace(/-/g, '').substring(0, 6);
  const existing = await db
    .query('shares')
    .withIndex('byCode', (q) => q.eq('code', code))
    .first();
  if (existing) {
    return generateUniqueCode(db);
  }
  return code;
}

export const getShareDescription = query({
  args: {
    code: v.string(),
  },
  returns: v.object({
    description: v.optional(v.string()),
  }),
  handler: async (ctx, { code }) => {
    const getShare = await ctx.db
      .query('shares')
      .withIndex('byCode', (q) => q.eq('code', code))
      .first();
    if (!getShare) {
      throw new ConvexError('Invalid share link');
    }
    return {
      description: getShare.description,
    };
  },
});

export const clone = mutation({
  args: {
    shareCode: v.string(),
    sessionId: v.id('sessions'),
    projectInitParams: v.object({
      teamSlug: v.string(),
      auth0AccessToken: v.string(),
    }),
  },
  returns: v.object({
    id: v.string(),
    description: v.optional(v.string()),
  }),
  handler: async (ctx, { shareCode, sessionId, projectInitParams }) => {
    const getShare = await ctx.db
      .query('shares')
      .withIndex('byCode', (q) => q.eq('code', shareCode))
      .first();
    if (!getShare) {
      throw new ConvexError('Invalid share link');
    }

    const parentChat = await ctx.db.get(getShare.chatId);
    if (!parentChat) {
      throw new Error('Parent chat not found');
    }
    const chatId = crypto.randomUUID();
    const clonedChat = {
      creatorId: sessionId,
      initialId: chatId,
      description: parentChat.description,
      timestamp: new Date().toISOString(),
      snapshotId: getShare.snapshotId,
    };
    const clonedChatId = await ctx.db.insert('chats', clonedChat);

    if (getShare.chatHistoryId) {
      await ctx.db.insert('chatMessagesStorageState', {
        chatId: clonedChatId,
        storageId: getShare.chatHistoryId,
        lastMessageRank: getShare.lastMessageRank,
        partIndex: getShare.partIndex ?? -1,
      });
    } else {
      const messages = await ctx.db
        .query('chatMessages')
        .withIndex('byChatId', (q) => q.eq('chatId', parentChat._id).lte('rank', getShare.lastMessageRank))
        .collect();
      for (const message of messages) {
        await ctx.db.insert('chatMessages', {
          chatId: clonedChatId,
          content: message.content,
          rank: message.rank,
        });
      }
    }

    await startProvisionConvexProjectHelper(ctx, {
      sessionId,
      chatId: clonedChat.initialId,
      projectInitParams,
    });

    return {
      id: chatId,
      description: parentChat.description,
    };
  },
});
