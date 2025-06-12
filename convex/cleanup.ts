import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const delayInMs = parseFloat(process.env.DEBUG_FILE_CLEANUP_DELAY_MS ?? "500");
const debugFileCleanupBatchSize = parseInt(process.env.DEBUG_FILE_CLEANUP_BATCH_SIZE ?? "100");

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

export const deleteOldChatStorageStates = internalMutation({
  args: {
    forReal: v.boolean(),
    cursor: v.optional(v.string()),
    shouldScheduleNext: v.boolean(),
    numRewindableMessages: v.number(),
  },
  handler: async (ctx, { forReal, cursor, shouldScheduleNext, numRewindableMessages }) => {
    const { page, isDone, continueCursor } = await ctx.db.query("chatMessagesStorageState").paginate({
      numItems: debugFileCleanupBatchSize,
      cursor: cursor ?? null,
    });
  },
});
