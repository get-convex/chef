import { ConvexError, v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { getChatByIdOrUrlIdEnsuringAccess } from "./messages";
import { generateUniqueCode } from "./share";

// Create or modify a share record
export const share = mutation({
  args: {
    sessionId: v.id("sessions"),
    id: v.string(),
    shared: v.union(v.literal("shared"), v.literal("expresslyUnshared"), v.literal("noPreferenceExpressed")),
    allowForkFromLatest: v.boolean(),
    thumbnailImageStorageId: v.optional(v.id("_storage")),
    referralCode: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { sessionId, id, shared, allowForkFromLatest, referralCode }) => {
    // Validate referral code if set
    if (referralCode !== undefined && referralCode !== null) {
      // Only allow alphanumeric, dashes, and underscores
      if (!/^[a-zA-Z0-9_-]+$/.test(referralCode)) {
        throw new ConvexError("Invalid referral code: must be alphanumeric, dashes, or underscores only");
      }
    }
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id, sessionId });
    if (!chat) {
      throw new ConvexError("Chat not found");
    }
    const existing = await ctx.db
      .query("socialShares")
      .withIndex("byChatId", (q) => q.eq("chatId", chat._id))
      .unique();

    // Not currently configurable but behavior we'll want to remember for later.
    const linkToDeployed = true;
    const allowShowInGallery = false;

    if (!existing) {
      const code = await generateUniqueCode(ctx.db);
      await ctx.db.insert("socialShares", {
        chatId: chat._id,
        code,
        shared,
        linkToDeployed,
        allowForkFromLatest,
        allowShowInGallery,
        referralCode,
      });
      return code;
    } else {
      await ctx.db.replace(existing._id, {
        ...existing,
        shared,
        allowForkFromLatest,
        allowShowInGallery,
        referralCode,
      });
      return existing.code;
    }
  },
});

export const getSocialShare = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, { code }) => {
    return await getSocialShareInner(ctx, code);
  },
});

export const getSocialShareOrIsSnapshotShare = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, { code }) => {
    try {
      return await getSocialShareInner(ctx, code);
    } catch (e: any) {
      if (e instanceof NotASocialShare) {
        const snapshotShare = await ctx.db
          .query("shares")
          .withIndex("byCode", (q) => q.eq("code", code))
          .first();
        if (snapshotShare) {
          return { isSnapshotShare: true };
        }
      }
      throw e;
    }
  },
});

class NotASocialShare extends ConvexError<string> {}

async function getSocialShareInner(ctx: QueryCtx, code: string) {
  const socialShare = await ctx.db
    .query("socialShares")
    .withIndex("byCode", (q) => q.eq("code", code))
    .first();
  if (!socialShare) {
    throw new NotASocialShare("Invalid share link");
  }
  const chat = await ctx.db.get(socialShare.chatId);
  if (!chat) {
    throw new ConvexError("Invalid chat");
  }

  const session = await ctx.db.get(chat.creatorId);
  const authorProfile = session?.memberId ? ((await ctx.db.get(session.memberId))?.cachedProfile ?? null) : null;

  const chatHasBeenDeployed = !!chat.hasBeenDeployed;

  const thumbnailUrl = socialShare.thumbnailImageStorageId
    ? await ctx.storage.getUrl(socialShare.thumbnailImageStorageId)
    : null;

  const deployedUrl =
    chatHasBeenDeployed && chat.convexProject?.kind === "connected"
      ? `https://${chat.convexProject.deploymentName}.convex.app`
      : null;

  return {
    description: chat.description || null,
    code,
    shared: socialShare.shared,
    allowShowInGallery: socialShare.allowShowInGallery,
    hasBeenDeployed: chatHasBeenDeployed,
    deployedUrl,
    thumbnailUrl,
    referralCode: socialShare.referralCode || null,
    author: authorProfile
      ? {
          username: authorProfile.username,
          avatar: authorProfile.avatar,
        }
      : null,
  };
}

export const getCurrentSocialShare = query({
  args: {
    sessionId: v.id("sessions"),
    id: v.string(),
  },
  handler: async (ctx, { sessionId, id }) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id, sessionId });
    if (!chat) {
      throw new ConvexError("Chat not found");
    }

    const socialShare = await ctx.db
      .query("socialShares")
      .withIndex("byChatId", (q) => q.eq("chatId", chat._id))
      .unique();

    if (!socialShare) {
      return null;
    }

    return {
      shared: socialShare.shared,
      allowForkFromLatest: socialShare.allowForkFromLatest,
      code: socialShare.code,
      thumbnailImageStorageId: socialShare.thumbnailImageStorageId,
      referralCode: socialShare.referralCode,
    };
  },
});

export const saveThumbnail = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    urlId: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { sessionId, urlId, storageId }) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: urlId, sessionId });
    if (!chat) {
      throw new ConvexError("Chat not found");
    }

    // Get or create social share
    const existing = await ctx.db
      .query("socialShares")
      .withIndex("byChatId", (q) => q.eq("chatId", chat._id))
      .unique();

    if (!existing) {
      const code = await generateUniqueCode(ctx.db);
      await ctx.db.insert("socialShares", {
        chatId: chat._id,
        code,
        thumbnailImageStorageId: storageId,
        shared: "noPreferenceExpressed",
        linkToDeployed: true,
        allowForkFromLatest: false,
        allowShowInGallery: false,
      });
    } else {
      // If there was a previous thumbnail, delete it
      if (existing.thumbnailImageStorageId) {
        await ctx.storage.delete(existing.thumbnailImageStorageId);
      }

      await ctx.db.patch(existing._id, {
        thumbnailImageStorageId: storageId,
      });
    }
  },
});

// This is used for admin's to create a share link for debugging purposes. Be sure to delete the share link after use.
export const createAdminShare = internalMutation({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, { chatId }) => {
    const chat = await ctx.db.get(chatId);
    if (!chat) {
      throw new ConvexError("Chat not found");
    }
    // Use an existing share link for this chat if it exists
    const existing = await ctx.db
      .query("socialShares")
      .withIndex("byChatId", (q) => q.eq("chatId", chatId))
      .unique();
    if (existing) {
      console.log(`Already have a share for chat ${chatId}: Go to https://chef.show/${existing.code}`);
      return existing._id;
    }

    const randomCode = await generateUniqueCode(ctx.db);
    const code = `support-${randomCode}`;
    const id = await ctx.db.insert("socialShares", {
      chatId,
      code,
      shared: "shared",
      linkToDeployed: false,
      allowForkFromLatest: true,
      allowShowInGallery: false,
    });
    console.log(`Created admin share for chat ${chatId}. Go to https://chef.show/${code}`);
    return id;
  },
});
