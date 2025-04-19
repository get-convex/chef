import { ConvexError, v } from 'convex/values';
import { internalAction, internalMutation, mutation, query, type DatabaseReader } from './_generated/server';
import { getChatByIdOrUrlIdEnsuringAccess, getLatestChatMessageStorageState, type SerializedMessage } from './messages';
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

    const code = await generateUniqueCode(ctx.db);

    const storageState = await getLatestChatMessageStorageState(ctx, chat);

    if (storageState) {
      if (storageState.storageId === null) {
        throw new ConvexError('Chat history not found');
      }
      const snapshotId = storageState.snapshotId ?? chat.snapshotId;
      if (!snapshotId) {
        throw new ConvexError('Your project has never been saved.');
      }
      await ctx.db.insert('shares', {
        chatId: chat._id,

        // It is safe to use the snapshotId from the chat because the user’s
        // snapshot excludes .env.local.
        snapshotId,

        chatHistoryId: storageState.storageId,

        code,
        lastMessageRank: storageState.lastMessageRank,
        partIndex: storageState.partIndex,
        description: chat.description,
      });
      return { code };
    } else {
      if (!chat.snapshotId) {
        throw new ConvexError('Your project has never been saved.');
      }
      console.warn('No storage state found for chat, using last message rank');
      const messages = await ctx.db
        .query('chatMessages')
        .withIndex('byChatId', (q) => q.eq('chatId', chat._id))
        .order('desc')
        .collect();
      const compressedMessages = await compressMessages(messages.map((m) => m.content));
      const lastMessage = messages[messages.length - 1];
      const partIndex = ((lastMessage?.content as SerializedMessage)?.parts?.length ?? 0) - 1;
      const shareId = await ctx.db.insert('shares', {
        chatId: chat._id,
        code,
        chatHistoryId: null,
        lastMessageRank: lastMessage?.rank ?? -1,
        partIndex,
        description: chat.description,
        snapshotId: chat.snapshotId,
      });
      await ctx.scheduler.runAfter(0, internal.share.intializeShareWithStorage, {
        shareId,
        compressedMessages: compressedMessages.buffer,
      });
      return { code };
    }
  },
});

export const intializeShareWithStorage = internalAction({
  args: {
    shareId: v.id('shares'),
    compressedMessages: v.bytes(),
  },
  handler: async (ctx, { shareId, compressedMessages }) => {
    const blob = new Blob([compressedMessages]);
    const storageId = await ctx.storage.store(blob);
    await ctx.runMutation(internal.share.updateShareWithStorage, {
      shareId,
      storageId,
    });
  },
});

export const updateShareWithStorage = internalMutation({
  args: {
    shareId: v.id('shares'),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, { shareId, storageId }) => {
    await ctx.db.patch(shareId, {
      chatHistoryId: storageId,
    });
  },
});

export const isShareReady = query({
  args: {
    code: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, { code }) => {
    const share = await ctx.db
      .query('shares')
      .withIndex('byCode', (q) => q.eq('code', code))
      .unique();
    if (!share) {
      return false;
    }
    return share.chatHistoryId !== null;
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
      throw new ConvexError({
        code: 'NotFound',
        message: 'The original chat was not found. It may have been deleted.',
      });
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
