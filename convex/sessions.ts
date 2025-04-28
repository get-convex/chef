import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getChatByIdOrUrlIdEnsuringAccess } from "./messages";

export const verifySession = query({
  args: {
    sessionId: v.string(),
    flexAuthMode: v.optional(v.literal("ConvexOAuth")),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.normalizeId("sessions", args.sessionId);
    if (!sessionId) {
      return false;
    }
    const session = await ctx.db.get(sessionId);
    if (!session || !session.memberId) {
      return false;
    }
    return isValidSessionForConvexOAuth(ctx, { sessionId, memberId: session.memberId });
  },
});

export async function isValidSession(ctx: QueryCtx, args: { sessionId: Id<"sessions"> }) {
  const session = await ctx.db.get(args.sessionId);
  if (!session || !session.memberId) {
    return false;
  }
  return await isValidSessionForConvexOAuth(ctx, { sessionId: args.sessionId, memberId: session.memberId });
}

async function isValidSessionForConvexOAuth(
  ctx: QueryCtx,
  args: { sessionId: Id<"sessions">; memberId: Id<"convexMembers"> },
): Promise<boolean> {
  const member = await ctx.db.get(args.memberId);
  if (!member) {
    return false;
  }
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    // Having the sessionId should be enough -- they should be unguessable
    return true;
  }
  // But if we have the identity, it better match
  return identity.tokenIdentifier === member.tokenIdentifier;
}

export const registerConvexOAuthConnection = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    chatId: v.id("chats"),
    projectSlug: v.string(),
    teamSlug: v.string(),
    deploymentUrl: v.string(),
    deploymentName: v.string(),
    projectDeployKey: v.string(),
  },
  handler: async (ctx, args) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, {
      id: args.chatId,
      sessionId: args.sessionId,
    });
    if (!chat) {
      throw new ConvexError({ code: "NotAuthorized", message: "Chat not found" });
    }
    const session = await ctx.db.get(args.sessionId);
    if (!session || !session.memberId) {
      throw new ConvexError({ code: "NotAuthorized", message: "Chat not found" });
    }
    await ctx.db.patch(args.chatId, {
      convexProject: {
        kind: "connected",
        projectSlug: args.projectSlug,
        teamSlug: args.teamSlug,
        deploymentUrl: args.deploymentUrl,
        deploymentName: args.deploymentName,
      },
    });
    const credentials = await ctx.db
      .query("convexProjectCredentials")
      .withIndex("bySlugs", (q) => q.eq("teamSlug", args.teamSlug).eq("projectSlug", args.projectSlug))
      .collect();
    if (credentials.length === 0) {
      await ctx.db.insert("convexProjectCredentials", {
        teamSlug: args.teamSlug,
        projectSlug: args.projectSlug,
        projectDeployKey: args.projectDeployKey,
        memberId: session.memberId,
      });
    }
  },
});

export const startSession = mutation({
  args: {},
  returns: v.id("sessions"),
  handler: async (ctx) => {
    const member = await getOrCreateCurrentMember(ctx);
    const existingSession = await ctx.db
      .query("sessions")
      .withIndex("byMemberId", (q) => q.eq("memberId", member))
      .unique();
    if (existingSession) {
      return existingSession._id;
    }
    return ctx.db.insert("sessions", {
      memberId: member,
    });
  },
});

async function getOrCreateCurrentMember(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
  }
  const existingMember = await ctx.db
    .query("convexMembers")
    .withIndex("byTokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (existingMember) {
    return existingMember._id;
  }
  return ctx.db.insert("convexMembers", {
    tokenIdentifier: identity.tokenIdentifier,
  });
}

export async function getCurrentMember(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
  }
  const existingMember = await ctx.db
    .query("convexMembers")
    .withIndex("byTokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!existingMember) {
    throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
  }
  return existingMember;
}

export const cleanupInactiveSession = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    forReal: v.boolean(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      console.log("Session not found");
      return;
    }
    const chats = await ctx.db
      .query("chats")
      .withIndex("byCreatorAndId", (q) => q.eq("creatorId", session._id))
      .collect();
    console.log(`Found ${chats.length} chats for session ${session._id}`);
    for (const chat of chats) {
      console.log(`Deleting data for chat ${chat._id}`);
      const chatMessages = await ctx.db
        .query("chatMessages")
        .withIndex("byChatId", (q) => q.eq("chatId", chat._id))
        .collect();
      console.log(`Deleting ${chatMessages.length} messages for chat ${chat._id}`);
      for (const chatMessage of chatMessages) {
        await ctx.db.delete(chatMessage._id);
      }
      const connectedProject = chat.convexProject;
      if (connectedProject?.kind === "connected") {
        console.log(`Chat connected to project with deployment ${connectedProject.deploymentName}`);
        const allCredentials = await ctx.db
          .query("convexProjectCredentials")
          .withIndex("bySlugs", (q) =>
            q.eq("teamSlug", connectedProject.teamSlug).eq("projectSlug", connectedProject.projectSlug),
          )
          .collect();
        const credentials = allCredentials.filter((cred) => cred.memberId === session.memberId);
        if (credentials.length === 0) {
          console.log(`No credentials found for chat ${chat._id}`);
        } else if (credentials.length > 1) {
          console.warn(
            `Found ${credentials.length} credentials for chat ${chat._id}, leaving them since this is an unexpected state`,
          );
        } else {
          const credential = credentials[0];
          console.log(`Deleting credential ${credential._id} for chat ${chat._id}`);
          await ctx.db.delete(credential._id);
        }
      }
      await ctx.db.delete(chat._id);
      console.log(`Deleted data for chat ${chat._id}`);
    }
    console.log(`Deleting session ${session._id}`);
    await ctx.db.delete(session._id);
    if (!args.forReal) {
      console.error("Failing transaction since this is a dry run. Set --for-real to true to delete the session.");
      throw new Error("Dry run");
    }
  },
});
