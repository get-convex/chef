import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { CHAT_NOT_FOUND_ERROR, getChatByIdOrUrlIdEnsuringAccess, getLatestChatMessageStorageState } from "./messages";

export const get = query({
  args: {
    sessionId: v.id("sessions"),
    chatId: v.string(),
  },
  returns: v.array(v.object({ subchatIndex: v.number(), description: v.optional(v.string()) })),
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
    }));
  },
});

export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    chatId: v.string(),
  },
  returns: v.null(),
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
    if (newSubchatIndex > 200) {
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
    await ctx.db.patch(chat._id, {
      lastSubchatIndex: newSubchatIndex,
    });
  },
});
