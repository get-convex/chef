import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const delayInMs = parseFloat(process.env.DEBUG_FILE_CLEANUP_DELAY_MS ?? "500");
const debugFileCleanupBatchSize = parseInt(process.env.DEBUG_FILE_CLEANUP_BATCH_SIZE ?? "100");
const chatCleanupBatchSize = parseInt(process.env.CHAT_CLEANUP_BATCH_SIZE ?? "10");
const storageStateCleanupBatchSize = parseInt(process.env.STORAGE_STATE_CLEANUP_BATCH_SIZE ?? "100");

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

// Delete all the storage states and files for non-latest parts of a lastMessageRank
export const deleteOldStorageStatesForLastMessageRank = internalMutation({
  args: {
    chatId: v.id("chats"),
    lastMessageRank: v.number(),
    forReal: v.boolean(),
  },
  handler: async (ctx, { chatId, lastMessageRank, forReal }) => {
    const storageStates = await ctx.db
      .query("chatMessagesStorageState")
      .withIndex("byChatId", (q) => q.eq("chatId", chatId).eq("lastMessageRank", lastMessageRank))
      .order("asc")
      .collect();
    // Nothing to delete if there is only one record for the chatId and lastMessageRank
    if (storageStates.length <= 1) {
      return;
    }
    const latestSnapshotId = storageStates[storageStates.length - 1].snapshotId;

    // Delete all storage states except the last one
    const deletedStorageIds = new Set<Id<"_storage">>();
    for (let i = 0; i < storageStates.length - 1; i++) {
      const storageState = storageStates[i];
      if (forReal) {
        if (storageState.storageId !== null) {
          if (!deletedStorageIds.has(storageState.storageId)) {
            await ctx.storage.delete(storageState.storageId);
            deletedStorageIds.add(storageState.storageId);
          }
          console.log(
            `Deleted storageId ${storageState.storageId} for chat ${chatId} and lastMessageRank ${lastMessageRank}`,
          );
        }
        if (latestSnapshotId === undefined && storageState.snapshotId !== undefined) {
          throw new Error(
            `Latest snapshot ID is undefined for chat ${chatId} and lastMessageRank ${lastMessageRank} but earlier storage state ${storageState._id} has a snapshotId`,
          );
        }
        // Do not remove the latest snapshotId!
        if (
          storageState.snapshotId &&
          storageState.snapshotId !== latestSnapshotId &&
          !deletedStorageIds.has(storageState.snapshotId)
        ) {
          await ctx.storage.delete(storageState.snapshotId);
          console.log(
            `Deleted snapshotId ${storageState.snapshotId} for chat ${chatId} and lastMessageRank ${lastMessageRank}`,
          );
          deletedStorageIds.add(storageState.snapshotId);
        }
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
  },
});
