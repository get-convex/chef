import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const delayInMs = parseFloat(process.env.DEBUG_FILE_CLEANUP_DELAY_MS ?? "500");

export const deleteDebugFilesForInactiveChats = internalMutation({
  args: {
    forReal: v.boolean(),
    cursor: v.optional(v.string()),
    shouldScheduleNext: v.boolean(),
    ageInDays: v.number(),
  },
  handler: async (ctx, { forReal, cursor, shouldScheduleNext, ageInDays }) => {
    const { page, isDone, continueCursor } = await ctx.db.query("debugChatApiRequestLog").paginate({
      numItems: 10,
      cursor: cursor ?? null,
    });
    for (const doc of page) {
      const storageState = await ctx.db
        .query("chatMessagesStorageState")
        .withIndex("byChatId", (q) => q.eq("chatId", doc.chatId))
        .order("desc")
        .first();
      if (storageState === null) {
        throw new Error(`Chat ${doc.chatId} not found in chatMessagesStorageState`);
      }
      if (storageState._creationTime < Date.now() - 1000 * 60 * 60 * 24 * ageInDays) {
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
        ageInDays,
      });
    }
  },
});

// Paginate over the debugChatApiRequestLog table
// Check if the chat is inactive - no chatMessagesStorageState in the past two weeks
// Delete the debug files
// Run this on a cron every day
// Maybe instead of an action it should be a scheduled job
