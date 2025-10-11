import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

const delayInMs = parseFloat(process.env.DEBUG_FILE_CLEANUP_DELAY_MS ?? "500");
const debugFileCleanupBatchSize = parseInt(process.env.DEBUG_FILE_CLEANUP_BATCH_SIZE ?? "100");
const chatCleanupBatchSize = parseInt(process.env.CHAT_CLEANUP_BATCH_SIZE ?? "10");
const storageStateCleanupBatchSize = parseInt(process.env.STORAGE_STATE_CLEANUP_BATCH_SIZE ?? "50");

export const deleteDebugFilesForInactiveChats = internalMutation({
  args: {
    forReal: v.boolean(),
    cursor: v.optional(v.string()),
    shouldScheduleNext: v.boolean(),
    daysInactive: v.number(),
  },
  handler: async (ctx, { forReal, cursor, shouldScheduleNext, daysInactive }) => {
    const { page, isDone, continueCursor } = await ctx.db.query("debugChatApiRequestLog").paginate({
      numItems: debugFileCleanupBatchSize,
      cursor: cursor ?? null,
    });
    for (const doc of page) {
      if (doc._creationTime > Date.now() - 1000 * 60 * 60 * 24 * daysInactive) {
        return;
      }
      const storageState = await ctx.db
        .query("chatMessagesStorageState")
        .withIndex("byChatId", (q) => q.eq("chatId", doc.chatId))
        .order("desc")
        .first();
      if (storageState === null) {
        throw new Error(`Chat ${doc.chatId} not found in chatMessagesStorageState`);
      }
      if (storageState._creationTime < Date.now() - 1000 * 60 * 60 * 24 * daysInactive) {
        const lastActiveDate = new Date(storageState._creationTime).toISOString();
        if (forReal) {
          ctx.storage.delete(doc.promptCoreMessagesStorageId);
          await ctx.db.delete(doc._id);
          console.log(`Deleted debug file for chat ${doc.chatId} last active at ${lastActiveDate}`);
        } else {
          console.log(`Would delete debug file for chat ${doc.chatId} last active at ${lastActiveDate}`);
        }
      }
    }
    if (shouldScheduleNext && !isDone) {
      await ctx.scheduler.runAfter(delayInMs, internal.cleanup.deleteDebugFilesForInactiveChats, {
        forReal,
        cursor: continueCursor,
        shouldScheduleNext,
        daysInactive,
      });
    }
  },
});

// Paginates over the chats table and schedules a function to delete all old storage states for each chat.
// Schedules itself to keep iterating over chats table.
export const deleteAllOldChatStorageStates = internalMutation({
  args: {
    forReal: v.boolean(),
    cursor: v.optional(v.string()),
    shouldScheduleNext: v.boolean(),
  },
  handler: async (ctx, { forReal, cursor, shouldScheduleNext }) => {
    // Paginate over the chats table
    const { page, isDone, continueCursor } = await ctx.db.query("chats").paginate({
      numItems: chatCleanupBatchSize,
      cursor: cursor ?? null,
    });
    for (const chat of page) {
      console.log(`Scheduling cleanup for chat ${chat._id}`);
      await ctx.scheduler.runAfter(0, internal.cleanup.deleteOldChatStorageStates, {
        chatId: chat._id,
        forReal,
        shouldScheduleNext,
      });
    }
    if (shouldScheduleNext && !isDone) {
      await ctx.scheduler.runAfter(delayInMs, internal.cleanup.deleteAllOldChatStorageStates, {
        forReal,
        cursor: continueCursor,
        shouldScheduleNext,
      });
    }
  },
});

// Paginate over chat storage states, scheduling deletion of old storage states for each lastMessageRank
// TODO: Delete all storage states and files that are older than numRewindableMessages
export const deleteOldChatStorageStates = internalMutation({
  args: {
    chatId: v.id("chats"),
    forReal: v.boolean(),
    cursor: v.optional(v.string()),
    shouldScheduleNext: v.boolean(),
  },
  handler: async (ctx, { chatId, forReal, cursor, shouldScheduleNext }) => {
    const { page, isDone, continueCursor } = await ctx.db
      .query("chatMessagesStorageState")
      .withIndex("byChatId", (q) => q.eq("chatId", chatId))
      .paginate({
        numItems: storageStateCleanupBatchSize,
        cursor: cursor ?? null,
      });
    const lastMessageRankCounts = new Map<number, number>();
    for (const storageState of page) {
      lastMessageRankCounts.set(
        storageState.lastMessageRank,
        (lastMessageRankCounts.get(storageState.lastMessageRank) ?? 0) + 1,
      );
    }
    // Falsely set the lastMessageRank count to 2 for the last one because it might have more in the next page.
    // 2 is arbitrary. Just needs to be greater than 1.
    // We could just schedule the job anyway and not worry about counting here, but more than half the
    // lastMessageRank counts are 1 from user messages and chat initialization, so we would be unnecessarily
    // scheduling a bunch of functions that don't do anything.
    if (page.length > 0) {
      lastMessageRankCounts.set(page[page.length - 1].lastMessageRank, 2);
      for (const [lastMessageRank, count] of lastMessageRankCounts) {
        if (count > 1) {
          console.log(`Scheduling cleanup for chat ${chatId} and lastMessageRank ${lastMessageRank}`);
          await ctx.scheduler.runAfter(0, internal.cleanup.deleteOldStorageStatesForLastMessageRank, {
            chatId,
            lastMessageRank,
            forReal,
          });
        }
      }
    }

    if (shouldScheduleNext && !isDone) {
      await ctx.scheduler.runAfter(delayInMs, internal.cleanup.deleteOldChatStorageStates, {
        chatId,
        forReal,
        cursor: continueCursor,
        shouldScheduleNext,
      });
    }
  },
});

// Delete all the storage states for non-latest parts of a lastMessageRank
export const deleteOldStorageStatesForLastMessageRank = internalMutation({
  args: {
    chatId: v.id("chats"),
    lastMessageRank: v.number(),
    forReal: v.boolean(),
  },
  handler: async (ctx, { chatId, lastMessageRank, forReal }) => {
    const storageStates = await ctx.db
      .query("chatMessagesStorageState")
      .withIndex("byChatId", (q) => q.eq("chatId", chatId).eq("subchatIndex", 0).eq("lastMessageRank", lastMessageRank))
      .order("asc")
      .collect();
    // Nothing to delete if there is only one record for the chatId and lastMessageRank
    if (storageStates.length <= 1) {
      return;
    }
    for (let i = 0; i < storageStates.length - 1; i++) {
      const storageState = storageStates[i];
      if (storageState.storageId !== null) {
        if (forReal) {
          await ctx.db.delete(storageState._id);
          console.log(
            `Deleted storageState ${storageState._id} for chat ${chatId} and lastMessageRank ${lastMessageRank}`,
          );
        } else {
          console.log(
            `Would delete storageState ${storageState._id} for chat ${chatId} and lastMessageRank ${lastMessageRank}`,
          );
        }
      }
    }
  },
});

async function deleteFileIfUnreferenced(ctx: MutationCtx, storageId: Id<"_storage">, forReal: boolean) {
  // Check the storage id is not referenced in any tables
  const chatRef = await ctx.db
    .query("chats")
    .withIndex("bySnapshotId", (q) => q.eq("snapshotId", storageId))
    .first();
  if (chatRef) {
    console.log(`Skipping storage ${storageId} because it is referenced by chat ${chatRef._id}`);
    return false;
  }
  const chatHistorySnapshotRef = await ctx.db
    .query("chatMessagesStorageState")
    .withIndex("bySnapshotId", (q) => q.eq("snapshotId", storageId))
    .first();
  if (chatHistorySnapshotRef) {
    console.log(
      `Skipping storage ${storageId} because it is referenced by chat history snapshot ${chatHistorySnapshotRef._id}`,
    );
    return false;
  }
  const chatHistoryStorageRef = await ctx.db
    .query("chatMessagesStorageState")
    .withIndex("byStorageId", (q) => q.eq("storageId", storageId))
    .first();
  if (chatHistoryStorageRef) {
    console.log(
      `Skipping storage ${storageId} because it is referenced by chat history storage ${chatHistoryStorageRef._id}`,
    );
    return false;
  }
  const shareSnapshotRef = await ctx.db
    .query("shares")
    .withIndex("bySnapshotId", (q) => q.eq("snapshotId", storageId))
    .first();
  if (shareSnapshotRef) {
    console.log(`Skipping storage ${storageId} because it is referenced by share snapshot ${shareSnapshotRef._id}`);
    return false;
  }
  const shareChatHistorySnapshotRef = await ctx.db
    .query("shares")
    .withIndex("byChatHistoryId", (q) => q.eq("chatHistoryId", storageId))
    .first();
  if (shareChatHistorySnapshotRef) {
    console.log(
      `Skipping storage ${storageId} because it is referenced by share chat history snapshot ${shareChatHistorySnapshotRef._id}`,
    );
    return false;
  }

  const socialShareRef = await ctx.db
    .query("socialShares")
    .withIndex("byThumbnailImageStorageId", (q) => q.eq("thumbnailImageStorageId", storageId))
    .first();
  if (socialShareRef) {
    console.log(`Skipping storage ${storageId} because it is referenced by social share ${socialShareRef._id}`);
    return false;
  }
  const debugChatApiRequestLogRef = await ctx.db
    .query("debugChatApiRequestLog")
    .withIndex("byStorageId", (q) => q.eq("promptCoreMessagesStorageId", storageId))
    .first();
  if (debugChatApiRequestLogRef) {
    console.log(
      `Skipping storage ${storageId} because it is referenced by debug chat api request log ${debugChatApiRequestLogRef._id}`,
    );
    return false;
  }
  if (forReal) {
    await ctx.storage.delete(storageId);
    console.log(`Deleted storage ${storageId}`);
  } else {
    console.log(`Would delete storage ${storageId}`);
  }
  return true;
}

export const deleteOrphanedFiles = internalMutation({
  args: {
    forReal: v.boolean(),
    shouldScheduleNext: v.boolean(),
    cursor: v.optional(v.string()),
    migrationId: v.optional(v.id("migrations")),
  },
  handler: async (ctx, { forReal, shouldScheduleNext, cursor, migrationId }) => {
    if (!migrationId) {
      migrationId = await ctx.db.insert("migrations", {
        name: "deleteOrphanedFiles",
        forReal,
        isDone: false,
        cursor: null,
        processed: 0,
        numDeleted: 0,
      });
    }
    const { page, isDone, continueCursor } = await ctx.db.system.query("_storage").paginate({
      numItems: storageStateCleanupBatchSize,
      cursor: cursor ?? null,
    });
    let numDeleted = 0;
    for (const storage of page) {
      if (await deleteFileIfUnreferenced(ctx, storage._id, forReal)) {
        numDeleted++;
      }
    }

    const migration = await ctx.db.get(migrationId);
    if (!migration) {
      throw new Error(`Migration ${migrationId} not found`);
    }
    await ctx.db.patch(migrationId, {
      processed: page.length + migration.processed,
      cursor: continueCursor,
      isDone: isDone,
      numDeleted: numDeleted + migration.numDeleted,
    });
    if (isDone) {
      await ctx.db.patch(migrationId, {
        latestEnd: Date.now(),
      });
    }
    if (shouldScheduleNext && !isDone) {
      await ctx.scheduler.runAfter(delayInMs, internal.cleanup.deleteOrphanedFiles, {
        forReal,
        shouldScheduleNext,
        cursor: continueCursor,
        migrationId,
      });
    }
  },
});

// Helper to double check that all the files referenced are still in storage after calling `deleteOrphanedFiles`
export const getReferencedFiles = internalQuery({
  args: {},
  handler: async (ctx) => {
    const storageStates = await ctx.db.query("chatMessagesStorageState").collect();
    for (const storageState of storageStates) {
      if (storageState.storageId !== null) {
        const url = await ctx.storage.getUrl(storageState.storageId);
        if (!url) {
          throw new Error(
            `Storage ${storageState.storageId} not found, associated with chatMessagesStorageState ${storageState._id}`,
          );
        }
      }
      if (storageState.snapshotId) {
        const url = await ctx.storage.getUrl(storageState.snapshotId);
        if (!url) {
          throw new Error(
            `Storage ${storageState.snapshotId} not found, associated with chatMessagesStorageState ${storageState._id}`,
          );
        }
      }
    }
    const shares = await ctx.db.query("shares").collect();
    for (const share of shares) {
      if (share.snapshotId) {
        const url = await ctx.storage.getUrl(share.snapshotId);
        if (!url) {
          throw new Error(`Storage ${share.snapshotId} not found, associated with share ${share._id}`);
        }
      }
    }

    const socialShares = await ctx.db.query("socialShares").collect();
    for (const socialShare of socialShares) {
      if (socialShare.thumbnailImageStorageId) {
        const url = await ctx.storage.getUrl(socialShare.thumbnailImageStorageId);
        if (!url) {
          throw new Error(
            `Storage ${socialShare.thumbnailImageStorageId} not found, associated with social share ${socialShare._id}`,
          );
        }
      }
    }
    const debugChatApiRequestLogs = await ctx.db.query("debugChatApiRequestLog").collect();
    for (const debugChatApiRequestLog of debugChatApiRequestLogs) {
      if (debugChatApiRequestLog.promptCoreMessagesStorageId) {
        const url = await ctx.storage.getUrl(debugChatApiRequestLog.promptCoreMessagesStorageId);
        if (!url) {
          throw new Error(
            `Storage ${debugChatApiRequestLog.promptCoreMessagesStorageId} not found, associated with debug chat api request log ${debugChatApiRequestLog._id}`,
          );
        }
      }
    }
  },
});

const maxMembersToProcess = 1000;
export const deleteDataForDeletedMembers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const deletedMembers = await ctx.db
      .query("convexMembers")
      .withIndex("byIsDeletedAccount", (q) => q.eq("isDeletedAccount", true))
      .take(maxMembersToProcess);

    console.log(`Processing ${deletedMembers.length} soft-deleted members`);

    for (const deletedMember of deletedMembers) {
      await ctx.scheduler.runAfter(calculateJitteredDelay(50, 0.2), internal.cleanup.deleteDataForMember, {
        memberId: deletedMember._id,
      });
    }
  },
});

export const deleteDataForMember = internalMutation({
  args: { memberId: v.id("convexMembers") },
  handler: async (ctx, { memberId }) => {
    const member: Doc<"convexMembers"> = (await ctx.db.get(memberId)) as Doc<"convexMembers">;
    if (!member) {
      throw new Error(`Member ${memberId} not found`);
    }
    if (!member.isDeletedAccount) {
      throw new Error(`Member ${memberId} is not soft deleted`);
    }
    console.log(`Processing soft-deleted member ${memberId}`);
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("byMemberId", (q) => q.eq("memberId", memberId))
      .collect();

    if (sessions.length === 0) {
      console.log(`No sessions found for member ${memberId}, deleting member data`);
      const projectCredentials = await ctx.db
        .query("convexProjectCredentials")
        .withIndex("byMemberId", (q) => q.eq("memberId", memberId))
        .collect();
      for (const projectCredential of projectCredentials) {
        await ctx.db.delete(projectCredential._id);
      }
      const openaiTokens = await ctx.db
        .query("memberOpenAITokens")
        .withIndex("byMemberId", (q) => q.eq("memberId", memberId))
        .collect();
      for (const openaiToken of openaiTokens) {
        await ctx.db.delete(openaiToken._id);
      }

      const resendTokens = await ctx.db
        .query("resendTokens")
        .withIndex("byMemberId", (q) => q.eq("memberId", memberId))
        .collect();
      for (const resendToken of resendTokens) {
        await ctx.db.delete(resendToken._id);
      }

      const convexAdmins = await ctx.db
        .query("convexAdmins")
        .withIndex("byConvexMemberId", (q) => q.eq("memberId", memberId))
        .collect();
      for (const convexAdmin of convexAdmins) {
        await ctx.db.delete(convexAdmin._id);
      }

      await ctx.db.delete(memberId);
      return;
    }

    for (const session of sessions) {
      const chats = await ctx.db
        .query("chats")
        .withIndex("byCreatorAndId", (q) => q.eq("creatorId", session._id))
        .collect();

      if (chats.length === 0) {
        console.log(`No chats found for session ${session._id}, deleting session`);
        await ctx.db.delete(session._id);
        return;
      }

      for (const chat of chats) {
        ctx.scheduler.runAfter(calculateJitteredDelay(50, 0.2), internal.cleanup.deleteChat, {
          chatId: chat._id,
        });
      }
    }
  },
});

export const deleteChat = internalMutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, { chatId }) => {
    const chat: Doc<"chats"> = (await ctx.db.get(chatId)) as Doc<"chats">;
    if (!chat) {
      throw new Error(`Chat ${chatId} not found`);
    }

    const messages = await ctx.db
      .query("chatMessagesStorageState")
      .withIndex("byChatId", (q) => q.eq("chatId", chat._id))
      .collect();

    if (messages.length === 0) {
      console.log(`No messages found for chat ${chat._id}, deleting chat`);
      await ctx.db.delete(chat._id);
      return;
    }

    const debugLogs = await ctx.db
      .query("debugChatApiRequestLog")
      .withIndex("byChatId", (q) => q.eq("chatId", chat._id))
      .collect();

    for (const log of debugLogs) {
      await ctx.db.delete(log._id);
    }

    for (const message of messages) {
      if (message.storageId) {
        await ctx.storage.delete(message.storageId);
      }
      // also snapshot id
      // also delete shares
      await ctx.db.delete(message._id);
    }
  },
});

function calculateJitteredDelay(baseDelayMs: number, jitterFactor: number) {
  // Generate a random number between -jitterFactor and +jitterFactor
  const randomJitter = (Math.random() * 2 - 1) * jitterFactor;
  // Apply the jitter to the base delay
  return baseDelayMs * (1 + randomJitter);
}
