import { v } from 'convex/values';
import { internalMutation, type ActionCtx, type MutationCtx, internalAction } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { compressMessages } from './compressMessages';

/**
 * There are two (and a half) migrations:
 * - For any shared chats, migrate them to read from storage instead of from the DB.
 * - For everything in `chatMessages`
 *   - If it's soft-deleted, hard delete it
 *   - Move it to be stored in file storage, soft-delete the messages, and then hard delete them
 *
 * The second migration is easier once the first migration has happened since
 * it will then be impossible for shared chats
 *
 * Entry point is `migrateMessages` -- the goal is to empty the `chatMessages` table
 * in favor of `chatMessagesStorageState` and
 *
 * It takes the oldest message in `chatMessages` -- if it's soft-deleted, it hard deletes
 * all messages for the chat.
 *
 * If the message is not soft-deleted, it migrates the message to storage and updates the
 * `chatMessagesStorageState` to point to the new storage ID.
 *
 * It then waits for the soft-deleted message delay before hard-deleting the message from
 * `chatMessages`.
 *
 * After hard deleting the messages, it schedules `migrateMessages` to run again.
 *
 * It's possible for this migration to fail at some point, but it should always be safe
 * to restart.
 */

export const migrateSharedChats = internalMutation({
  args: {
    forReal: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
    shouldScheduleNext: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const sharesPage = await ctx.db
      .query('shares')
      .withIndex('by_creation_time')
      .order('asc')
      .paginate({
        cursor: args.cursor ?? null,
        numItems: 1,
      });
    if (sharesPage.isDone) {
      console.log('No more shares to migrate');
      return;
    }
    const share = sharesPage.page[0];
    const continueCursor = sharesPage.continueCursor;
    if (share === null) {
      console.log('Empty page, but not done, so continuing');
      if (!args.shouldScheduleNext) {
        console.log(
          'Would have scheduled next migration of shared chats, but not scheduled, continue cursor is: ',
          continueCursor,
        );
        return;
      }
      await ctx.scheduler.runAfter(getMigrationDelayMs(), internal.messageMigration.migrateSharedChats, {
        forReal: args.forReal,
        cursor: continueCursor,
        shouldScheduleNext: args.shouldScheduleNext,
      });
      return;
    }
    if (share.chatHistoryId !== undefined) {
      console.log(`Share ${share._id} has a chat history ID, so skipping`);
      if (!args.shouldScheduleNext) {
        console.log(
          'Would have scheduled next migration of shared chats, but not scheduled, continue cursor is: ',
          continueCursor,
        );
        return;
      }
      await ctx.scheduler.runAfter(getMigrationDelayMs(), internal.messageMigration.migrateSharedChats, {
        forReal: args.forReal,
        cursor: continueCursor,
        shouldScheduleNext: args.shouldScheduleNext,
      });
      return;
    }
    console.log(`Migrating share ${share._id} to storage`);
    const messages = await ctx.db
      .query('chatMessages')
      .withIndex('byChatId', (q) => q.eq('chatId', share.chatId).lte('rank', share.lastMessageRank))
      .collect();
    const compressed = await compressMessages(messages.map((m) => m.content));
    await ctx.scheduler.runAfter(0, internal.messageMigration.migrateSharedChatToStorage, {
      shareId: share._id,
      compressedMessages: compressed.buffer,
      forReal: args.forReal,
      cursor: continueCursor,
      shouldScheduleNext: args.shouldScheduleNext,
    });
  },
});

export const migrateSharedChatToStorage = internalAction({
  args: {
    shareId: v.id('shares'),
    compressedMessages: v.bytes(),
    forReal: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
    shouldScheduleNext: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!args.forReal) {
      console.log(`Would have migrated shared chat to storage, but not for real: ${args.shareId}`);
      return;
    }
    const blob = new Blob([args.compressedMessages]);
    const storageId = await ctx.storage.store(blob);
    await ctx.runMutation(internal.messageMigration.updateSharedChatWithStorageId, {
      shareId: args.shareId,
      storageId,
    });
    console.log(`Migrated shared chat ${args.shareId} to storage`);
    if (!args.shouldScheduleNext) {
      console.log(
        'Would have scheduled next migration of shared chats, but not scheduled, continue cursor is: ',
        args.cursor,
      );
      return;
    }
    await ctx.scheduler.runAfter(getMigrationDelayMs(), internal.messageMigration.migrateSharedChats, {
      forReal: args.forReal,
      cursor: args.cursor,
      shouldScheduleNext: args.shouldScheduleNext,
    });
  },
});

export const updateSharedChatWithStorageId = internalMutation({
  args: {
    shareId: v.id('shares'),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.shareId, {
      chatHistoryId: args.storageId,
    });
  },
});

export const migrateMessages = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    forReal: v.optional(v.boolean()),
    shouldScheduleNext: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    console.log('Starting message migration');
    const messagesPage = await ctx.db
      .query('chatMessages')
      .withIndex('byChatId')
      .paginate({
        cursor: args.cursor ?? null,
        numItems: 1,
      });
    if (messagesPage.isDone) {
      console.log('No more messages to migrate');
      return;
    }
    const message = messagesPage.page[0];
    const continueCursor = messagesPage.continueCursor;
    if (message === null) {
      console.log('Empty page, but not done, so continuing');
      if (!args.shouldScheduleNext) {
        console.log(
          'Would have scheduled next migration of messages, but not scheduled, continue cursor is: ',
          continueCursor,
        );
        return;
      }
      await ctx.scheduler.runAfter(getMigrationDelayMs(), internal.messageMigration.migrateMessages, {
        cursor: continueCursor,
        forReal: args.forReal,
        shouldScheduleNext: args.shouldScheduleNext,
      });
      return;
    }
    console.log(`Migrating message: ${message._id} with chat id: ${message.chatId}`);
    const chat = await ctx.db.get(message.chatId);
    if (chat === null) {
      console.log(`Chat ${message.chatId} not found, deleting messages from DB`);
      await _deleteMessagesForChat(ctx, {
        chatId: message.chatId,
        forReal: args.forReal ?? false,
      });
      console.log(`Deleted messages for chat: ${message.chatId}`);
      if (!args.shouldScheduleNext) {
        console.log(`Would've scheduled next migration of messages starting at cursor: ${continueCursor}`);
        return;
      }
      await ctx.scheduler.runAfter(getMigrationDelayMs(), internal.messageMigration.migrateMessages, {
        forReal: args.forReal,
        cursor: continueCursor,
        shouldScheduleNext: args.shouldScheduleNext,
      });
      return;
    }
    const sessionId = chat.creatorId;
    if (message.deletedAt !== undefined) {
      console.log(`Found soft-deleted messages for chat: ${message.chatId}, hard deleting messages`);
      await _deleteMessagesForChat(ctx, {
        chatId: message.chatId,
        forReal: args.forReal ?? false,
      });
      console.log(`Deleted messages for chat: ${message.chatId}`);
      if (!args.shouldScheduleNext) {
        console.log(`Would've scheduled next migration of messages starting at cursor: ${continueCursor}`);
        return;
      }
      await ctx.scheduler.runAfter(getMigrationDelayMs(), internal.messageMigration.migrateMessages, {
        forReal: args.forReal,
        cursor: continueCursor,
        shouldScheduleNext: args.shouldScheduleNext,
      });
    } else {
      console.log(`Migrating messages to storage for chat: ${message.chatId}`);
      await ctx.scheduler.runAfter(0, internal.messageMigration.migrateMessagesForChat, {
        chatDocId: message.chatId,
        chatId: chat.initialId,
        sessionId,
        forReal: args.forReal,
        cursor: continueCursor,
        shouldScheduleNext: args.shouldScheduleNext,
      });
    }
  },
});

async function _deleteMessagesForChat(ctx: MutationCtx, args: { chatId: Id<'chats'>; forReal: boolean }) {
  const { chatId, forReal } = args;
  const chat = await ctx.db.get(chatId);
  if (chat === null) {
    console.warn(`Chat ${chatId} not found, probably already deleted, so deleting messages from DB`);
  } else {
    const storageState = await ctx.db
      .query('chatMessagesStorageState')
      .withIndex('byChatId', (q) => q.eq('chatId', chatId))
      .unique();
    if (storageState === null) {
      console.log('Chat messages storage state not found -- should not delete messages from DB if they are not stored');
      return;
    }
  }
  const messages = await ctx.db
    .query('chatMessages')
    .withIndex('byChatId', (q) => q.eq('chatId', chatId))
    .collect();
  for (const message of messages) {
    if (message.deletedAt === undefined) {
      throw new Error('Message has not been deleted');
    }
    if (!forReal) {
      console.log(`DRY RUN: Would delete message: ${message._id}`);
      continue;
    }
    await ctx.db.delete(message._id);
  }
}

export const deleteMessagesForChat = internalMutation({
  args: {
    chatId: v.id('chats'),
    forReal: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
    shouldScheduleNext: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    console.log(`Deleting messages for chat: ${args.chatId}`);
    await _deleteMessagesForChat(ctx, {
      chatId: args.chatId,
      forReal: args.forReal ?? false,
    });
    console.log(`Deleted messages for chat: ${args.chatId}`);
    if (!args.shouldScheduleNext) {
      console.log(`Would've scheduled next migration of messages starting at cursor: ${args.cursor}`);
      return;
    }
    await ctx.scheduler.runAfter(getMigrationDelayMs(), internal.messageMigration.migrateMessages, {
      forReal: args.forReal ?? false,
      cursor: args.cursor,
      shouldScheduleNext: args.shouldScheduleNext,
    });
  },
});

async function _migrateMessagesForChat(ctx: ActionCtx, chatId: string, sessionId: Id<'sessions'>, forReal: boolean) {
  const messages = await ctx.runQuery(internal.messages.getInitialMessagesInternal, {
    sessionId,
    id: chatId,
  });
  console.log(`Got ${messages.length} messages for chat: ${chatId}`);
  if (messages.length === 0) {
    return;
  }
  const lastMessageRank = messages.length - 1;
  const lastMessagePartIndex = (messages.at(-1)?.parts?.length ?? 0) - 1;
  const compressed = await compressMessages(messages);
  if (!forReal) {
    console.log(
      `DRY RUN: Would store compressed messages for chat: ${chatId}, last message rank: ${lastMessageRank}, part index: ${lastMessagePartIndex}`,
    );
    return;
  }
  const blob = new Blob([compressed]);
  const storageId = await ctx.storage.store(blob);
  await ctx.runMutation(internal.messages.handleStorageStateMigration, {
    sessionId,
    chatId,
    storageId,
    lastMessageRank,
    partIndex: lastMessagePartIndex,
    checkRanksMatch: true,
  });
}

export const migrateMessagesForChat = internalAction({
  args: {
    chatDocId: v.id('chats'),
    chatId: v.string(),
    sessionId: v.id('sessions'),
    forReal: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
    shouldScheduleNext: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await _migrateMessagesForChat(ctx, args.chatId, args.sessionId, args.forReal ?? false);
    console.log(`Migrating messages to storage for chat: ${args.chatDocId}`);
    await ctx.scheduler.runAfter(getSoftDeletedMessageDelayMs(), internal.messageMigration.deleteMessagesForChat, {
      chatId: args.chatDocId,
      forReal: args.forReal,
      cursor: args.cursor,
      shouldScheduleNext: args.shouldScheduleNext,
    });
    console.log(`Successfully scheduled deletion of messages for chat: ${args.chatDocId}`);
  },
});

const getMigrationDelayMs = () => {
  return process.env.MIGRATION_DELAY_MS ? parseInt(process.env.MIGRATION_DELAY_MS) : 5000;
};

const getSoftDeletedMessageDelayMs = () => {
  return process.env.SOFT_DELETED_MESSAGE_DELAY_MS ? parseInt(process.env.SOFT_DELETED_MESSAGE_DELAY_MS) : 5000;
};
