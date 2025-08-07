import { v } from "convex/values";
import { action, internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getChatByIdOrUrlIdEnsuringAccess } from "./messages";
import { internal } from "./_generated/api";

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

// Internal so we can trust this is actually what's in the Convex dashboard, but it's still just a cache
export const saveCachedProfile = internalMutation({
  args: {
    profile: v.object({
      username: v.string(),
      avatar: v.string(),
      email: v.string(),
      id: v.union(v.string(), v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const member = await getCurrentMember(ctx);
    const profile = {
      ...args.profile,
      id: String(args.profile.id),
    };
    await ctx.db.patch(member._id, {
      cachedProfile: profile,
    });
  },
});

export const updateCachedProfile = action({
  args: {
    convexAuthToken: v.string(),
  },
  handler: async (ctx, { convexAuthToken }) => {
    const auth0Profile = await ctx.auth.getUserIdentity();
    if (!auth0Profile) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }

    const url = `${process.env.BIG_BRAIN_HOST}/api/dashboard/profile`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${convexAuthToken}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      const body = await response.text.text();
      throw new Error(`Failed to fetch profile: ${response.statusText}: ${body}`);
    }

    const convexProfile: ConvexProfile = await response.json();

    const profile = {
      username: convexProfile.name || auth0Profile.name || auth0Profile.nickname || "",
      email: convexProfile.email || auth0Profile.email || "",
      avatar: auth0Profile.pictureUrl || "",
      id: convexProfile.id || auth0Profile.subject || "",
    };

    await ctx.runMutation(internal.sessions.saveCachedProfile, { profile });
  },
});

export interface ConvexProfile {
  name: string;
  email: string;
  id: string;
}
