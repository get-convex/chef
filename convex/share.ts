import { ConvexError, v } from "convex/values";
import { mutation, query, type DatabaseReader } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { getChatByIdOrUrlIdEnsuringAccess, getLatestChatMessageStorageState } from "./messages";
import { startProvisionConvexProjectHelper } from "./convexProjects";
import type { Id } from "./_generated/dataModel";

export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    id: v.string(),
  },
  handler: async (ctx, { sessionId, id }) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id, sessionId });
    if (!chat) {
      throw new ConvexError("Chat not found");
    }

    const code = await generateUniqueCode(ctx.db);

    const storageState = await getLatestChatMessageStorageState(ctx, {
      _id: chat._id,
      subchatIndex: chat.lastSubchatIndex,
    });

    if (!storageState) {
      throw new ConvexError("Your project has never been saved.");
    }
    if (storageState.storageId === null && chat.lastSubchatIndex === 0) {
      throw new ConvexError("Chat history not found");
    }
    const snapshotId = storageState.snapshotId ?? chat.snapshotId;
    if (!snapshotId) {
      throw new ConvexError("Your project has never been saved.");
    }
    await ctx.db.insert("shares", {
      chatId: chat._id,

      // It is safe to use the snapshotId from the chat because the user’s
      // snapshot excludes .env.local.
      snapshotId,

      chatHistoryId: storageState.storageId,

      code,
      lastMessageRank: storageState.lastMessageRank,
      lastSubchatIndex: chat.lastSubchatIndex,
      partIndex: storageState.partIndex,
      description: chat.description,
    });
    return { code };
  },
});

export const isShareReady = query({
  args: {
    code: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, { code }) => {
    const share = await ctx.db
      .query("shares")
      .withIndex("byCode", (q) => q.eq("code", code))
      .unique();
    if (!share) {
      return false;
    }
    return share.snapshotId !== null;
  },
});

// Unique across shares and socialShares in case these two url namespaces are combined.
export async function generateUniqueCode(db: DatabaseReader) {
  const code = crypto.randomUUID().replace(/-/g, "").substring(0, 6);
  let existing: { _id: any } | null = await db
    .query("shares")
    .withIndex("byCode", (q) => q.eq("code", code))
    .first();
  if (!existing) {
    existing = await db
      .query("socialShares")
      .withIndex("byCode", (q) => q.eq("code", code))
      .first();
  }
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
      .query("shares")
      .withIndex("byCode", (q) => q.eq("code", code))
      .first();
    if (!getShare) {
      const getShow = await ctx.db
        .query("socialShares")
        .withIndex("byCode", (q) => q.eq("code", code))
        .first();
      if (!getShow) {
        throw new ConvexError("Invalid share link");
      }
      const chat = await ctx.db.get(getShow.chatId);
      return {
        description: chat?.description,
      };
    }
    return {
      description: getShare.description,
    };
  },
});

export async function cloneShow(
  ctx: MutationCtx,
  {
    showCode,
    sessionId,
    projectInitParams,
  }: {
    showCode: string;
    sessionId: Id<"sessions">;
    projectInitParams: { teamSlug: string; workosAccessToken: string };
  },
): Promise<{ id: string; description?: string }> {
  const show = await ctx.db
    .query("socialShares")
    .withIndex("byCode", (q) => q.eq("code", showCode))
    .first();
  if (!show) {
    throw new ConvexError("Invalid share link");
  }
  if (!show.allowForkFromLatest) {
    throw new ConvexError("This show is not allowed to be forked.");
  }
  const parentChat = await ctx.db.get(show.chatId);
  if (!parentChat) {
    throw new ConvexError({
      code: "NotFound",
      message: "The original chat was not found. It may have been deleted.",
    });
  }

  const chatId = crypto.randomUUID();

  const storageState = await getLatestChatMessageStorageState(ctx, {
    _id: parentChat._id,
    subchatIndex: parentChat.lastSubchatIndex,
  });
  if (!storageState) {
    throw new ConvexError("Chat history not found");
  }
  if (storageState.storageId === null && parentChat.lastSubchatIndex === 0) {
    throw new ConvexError("Chat history not found");
  }
  const snapshotId = storageState.snapshotId ?? parentChat.snapshotId;
  if (!snapshotId) {
    throw new ConvexError("Your project has never been saved.");
  }

  const clonedChat = {
    creatorId: sessionId,
    initialId: chatId,
    description: parentChat.description,
    timestamp: new Date().toISOString(),
    snapshotId,
    lastSubchatIndex: parentChat.lastSubchatIndex,
    isDeleted: false,
  };
  const clonedChatId = await ctx.db.insert("chats", clonedChat);

  for (let i = 0; i < parentChat.lastSubchatIndex + 1; i++) {
    const storageState = await getLatestChatMessageStorageState(ctx, {
      _id: parentChat._id,
      subchatIndex: i,
    });
    if (storageState) {
      await ctx.db.insert("chatMessagesStorageState", {
        chatId: clonedChatId,
        storageId: storageState.storageId,
        lastMessageRank: storageState.lastMessageRank,
        subchatIndex: storageState.subchatIndex,
        partIndex: storageState.partIndex,
        snapshotId: storageState.snapshotId,
        description: storageState.description,
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
}

export const clone = mutation({
  args: {
    shareCode: v.string(),
    sessionId: v.id("sessions"),
    projectInitParams: v.object({
      teamSlug: v.string(),
      workosAccessToken: v.string(),
    }),
  },
  returns: v.object({
    id: v.string(),
    description: v.optional(v.string()),
  }),
  handler: async (ctx, { shareCode, sessionId, projectInitParams }) => {
    const getShare = await ctx.db
      .query("shares")
      .withIndex("byCode", (q) => q.eq("code", shareCode))
      .first();
    if (!getShare) {
      return cloneShow(ctx, { showCode: shareCode, sessionId, projectInitParams });
    }

    const parentChat = await ctx.db.get(getShare.chatId);
    if (!parentChat) {
      throw new ConvexError({
        code: "NotFound",
        message: "The original chat was not found. It may have been deleted.",
      });
    }
    const chatId = crypto.randomUUID();
    const clonedChat = {
      creatorId: sessionId,
      initialId: chatId,
      description: parentChat.description,
      timestamp: new Date().toISOString(),
      snapshotId: getShare.snapshotId,
      lastSubchatIndex: getShare.lastSubchatIndex,
      isDeleted: false,
    };
    const clonedChatId = await ctx.db.insert("chats", clonedChat);

    if (!getShare.chatHistoryId && getShare.lastSubchatIndex === 0) {
      throw new ConvexError({
        code: "NotFound",
        message: "The original chat history was not found. It may have been deleted.",
      });
    }
    // We clone all of the subchats except the last one, which is the current subchat
    for (let i = 0; i < getShare.lastSubchatIndex; i++) {
      const storageState = await getLatestChatMessageStorageState(ctx, {
        _id: parentChat._id,
        subchatIndex: i,
      });
      if (storageState) {
        await ctx.db.insert("chatMessagesStorageState", {
          chatId: clonedChatId,
          storageId: storageState.storageId,
          lastMessageRank: storageState.lastMessageRank,
          subchatIndex: storageState.subchatIndex,
          partIndex: storageState.partIndex,
          snapshotId: storageState.snapshotId,
          description: storageState.description,
        });
      }
    }
    const storageState = await getLatestChatMessageStorageState(ctx, {
      _id: parentChat._id,
      subchatIndex: getShare.lastSubchatIndex,
      lastMessageRank: getShare.lastMessageRank,
    });
    await ctx.db.insert("chatMessagesStorageState", {
      chatId: clonedChatId,
      storageId: getShare.chatHistoryId,
      snapshotId: getShare.snapshotId,
      lastMessageRank: getShare.lastMessageRank,
      subchatIndex: getShare.lastSubchatIndex,
      partIndex: getShare.partIndex ?? -1,
      description: storageState?.description,
    });

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
