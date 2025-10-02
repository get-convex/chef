import { v } from "convex/values";
import { action, internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getChatByIdOrUrlIdEnsuringAccess } from "./messages";
import { internal } from "./_generated/api";
import type { UserIdentity } from "convex/server";

export const verifySession = query({
  args: {
    sessionId: v.string(),
    flexAuthMode: v.optional(v.literal("ConvexOAuth")),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const sessionId = ctx.db.normalizeId("sessions", args.sessionId);
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
  return identity.convex_member_id === member.convexMemberId;
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
  const existingMembers = await getMemberByConvexMemberIdQuery(ctx, identity).collect();
  const existingMember = existingMembers[0];
  if (existingMembers.length > 1) {
    const sessionForExistingMember = await ctx.db
      .query("sessions")
      .withIndex("byMemberId", (q) => q.eq("memberId", existingMember._id))
      .unique();
    if (!sessionForExistingMember) {
      console.error("Found a member without a session!", existingMember._id, existingMember.convexMemberId);
      return existingMember._id;
    }

    let newApiKey = existingMember.apiKey;
    let newCachedProfile = existingMember.cachedProfile;
    // Migrate cached profile, api key, etc
    // Migrate chats for all other members to existing member
    for (const extraMember of existingMembers.slice(1)) {
      console.log("Migrating member ", extraMember._id, "to WorkOS");
      if (newApiKey === undefined && extraMember.apiKey !== undefined) {
        newApiKey = extraMember.apiKey;
      }
      if (newCachedProfile === undefined && extraMember.cachedProfile !== undefined) {
        newCachedProfile = extraMember.cachedProfile;
      }

      const sessionForExtraMember = await ctx.db
        .query("sessions")
        .withIndex("byMemberId", (q) => q.eq("memberId", extraMember._id))
        .unique();
      if (sessionForExtraMember) {
        const CHATS_TO_CHECK = 100;
        const chatsForExtraMember = await ctx.db
          .query("chats")
          .withIndex("byCreatorAndId", (q) => q.eq("creatorId", sessionForExtraMember._id))
          .take(CHATS_TO_CHECK);
        if (chatsForExtraMember.length === 0) {
          await ctx.db.patch(extraMember._id, {
            softDeletedForWorkOSMerge: true,
          });
        }
        if (chatsForExtraMember.length === CHATS_TO_CHECK) {
          console.warn("Too many chats to migrate in one go for member", extraMember.convexMemberId);
        }
        for (const chat of chatsForExtraMember) {
          await ctx.db.patch(chat._id, {
            creatorId: sessionForExistingMember._id,
            urlId: chat.urlId ? chat.urlId + "-" + extraMember._id.slice(0, 8) : undefined,
          });
        }
      } else {
        console.log("no session for member", extraMember.convexMemberId);
        await ctx.db.patch(extraMember._id, {
          softDeletedForWorkOSMerge: true,
        });
      }
    }

    await ctx.db.patch(existingMember._id, {
      cachedProfile: newCachedProfile,
      apiKey: newApiKey,
    });
  }

  if (existingMember) {
    return existingMember._id;
  }
  return ctx.db.insert("convexMembers", {
    tokenIdentifier: identity.tokenIdentifier,
    convexMemberId: identity.convex_member_id as string | undefined,
  });
}

export const convexMemberId = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const existingMember = await ctx.db
      .query("convexMembers")
      .withIndex("byConvexMemberId", (q) => q.eq("convexMemberId", identity.convex_member_id as string))
      .first();

    return existingMember?.convexMemberId;
  },
});

export async function getCurrentMember(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
  }
  const existingMember = await ctx.db
    .query("convexMembers")
    .withIndex("byConvexMemberId", (q) => q.eq("convexMemberId", identity.convex_member_id as string))
    .first();
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
    const workosProfile = await ctx.auth.getUserIdentity();
    if (!workosProfile) {
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
      const body = await response.text();
      throw new Error(`Failed to fetch profile: ${response.statusText}: ${body}`);
    }

    const convexProfile: ConvexProfile = await response.json();

    const profile = {
      username: convexProfile.name || workosProfile.name || workosProfile.nickname || "",
      email: convexProfile.email || workosProfile.email || "",
      avatar: workosProfile.pictureUrl || "",
      id: convexProfile.id || workosProfile.subject || "",
    };

    await ctx.runMutation(internal.sessions.saveCachedProfile, { profile });
  },
});

export interface ConvexProfile {
  name: string;
  email: string;
  id: string;
}

export function getMemberByConvexMemberIdQuery(ctx: QueryCtx, identity: UserIdentity) {
  return ctx.db
    .query("convexMembers")
    .withIndex("byConvexMemberId", (q) =>
      q.eq("convexMemberId", identity.convex_member_id as string).lt("softDeletedForWorkOSMerge", true),
    );
}
