import { internalMutation, mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  CHAT_NOT_FOUND_ERROR,
  deleteStorageState,
  getChatByIdOrUrlIdEnsuringAccess,
  getLatestChatMessageStorageState,
} from "./messages";
import { internal } from "./_generated/api";

// TODO(jordan): Change this to 1 and test pagination in tests once changes to convex-test are in
const subchatCleanupBatchSize = parseInt(process.env.SUBCHAT_CLEANUP_BATCH_SIZE ?? "128");

const MAX_SUBCHATS = 400;

export const get = query({
  args: {
    sessionId: v.id("sessions"),
    chatId: v.string(),
  },
  returns: v.array(v.object({ subchatIndex: v.number(), description: v.optional(v.string()), updatedAt: v.number() })),
  handler: async (ctx, args) => {
    const { chatId, sessionId } = args;
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    if (!chat) {
      throw CHAT_NOT_FOUND_ERROR;
    }

    let subchats: Doc<"chatMessagesStorageState">[] = [];
    for (let i = 0; i < chat.lastSubchatIndex + 1; i++) {
      const subchat = await ctx.db
        .query("chatMessagesStorageState")
        .withIndex("byChatId", (q) => q.eq("chatId", chat._id).eq("subchatIndex", i))
        .order("desc")
        .first();
      if (subchat === null) {
        continue;
      }
      subchats.push(subchat);
    }

    return subchats.map((subchat) => ({
      subchatIndex: subchat.subchatIndex,
      description: subchat.description,
      updatedAt: subchat._creationTime,
    }));
  },
});

export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    chatId: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { chatId, sessionId } = args;
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    if (!chat) {
      throw CHAT_NOT_FOUND_ERROR;
    }
    const latestStorageState = await getLatestChatMessageStorageState(ctx, {
      _id: chat._id,
      subchatIndex: chat.lastSubchatIndex,
    });
    const newSubchatIndex = chat.lastSubchatIndex + 1;
    if (newSubchatIndex > MAX_SUBCHATS) {
      throw new ConvexError({
        code: "TooManySubchats",
        message:
          "You have reached the maximum number of subchats. You must continue the conversation in the current subchat.",
      });
    }
    await ctx.db.insert("chatMessagesStorageState", {
      chatId: chat._id,
      storageId: null,
      lastMessageRank: -1,
      subchatIndex: newSubchatIndex,
      partIndex: -1,
      snapshotId: latestStorageState?.snapshotId,
    });
    await ctx.scheduler.runAfter(0, internal.subchats.cleanupOldSubchatStorageStates, {
      sessionId,
      chatId,
      newSubchatIndex,
      latestStorageState: latestStorageState?._id,
    });

    await ctx.db.patch(chat._id, {
      lastSubchatIndex: newSubchatIndex,
    });
    return newSubchatIndex;
  },
});

export const cleanupOldSubchatStorageStates = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    chatId: v.string(),
    newSubchatIndex: v.number(),
    latestStorageState: v.optional(v.id("chatMessagesStorageState")),
    cursor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { chatId, sessionId, newSubchatIndex, latestStorageState, cursor } = args;
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    if (!chat) {
      throw CHAT_NOT_FOUND_ERROR;
    }

    const query = ctx.db
      .query("chatMessagesStorageState")
      .withIndex("byChatId", (q) => q.eq("chatId", chat._id).eq("subchatIndex", newSubchatIndex - 1))
      .order("asc");

    const result = await query.paginate({
      cursor: cursor ?? null,
      numItems: subchatCleanupBatchSize,
    });

    for (const storageState of result.page) {
      // Don't delete the latest storage state because this is the one we will rewind
      // to if the user rewinds to this subchat
      if (storageState._id !== latestStorageState) {
        await deleteStorageState(ctx, storageState);
      }
    }

    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.subchats.cleanupOldSubchatStorageStates, {
        sessionId,
        chatId,
        newSubchatIndex,
        latestStorageState,
        cursor: result.continueCursor,
      });
    }
  },
});
