import { v } from 'convex/values';
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { ConvexError } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { getChatByIdOrUrlIdEnsuringAccess } from './messages';

export const getSession = mutation({
  args: {
    code: v.string(),
  },
  returns: v.id('sessions'),
  handler: async (ctx, args) => {
    const inviteCodes = await ctx.db
      .query('inviteCodes')
      .withIndex('byCode', (q) => q.eq('code', args.code))
      .collect();

    const activeInviteCode = inviteCodes.find((inviteCode) => inviteCode.isActive);

    if (!activeInviteCode) {
      throw new ConvexError({ code: 'NotAuthorized', message: 'Invalid invite code' });
    }
    await ctx.db.patch(activeInviteCode._id, {
      lastUsedTime: Date.now(),
    });

    return activeInviteCode.sessionId;
  },
});

export const verifySession = query({
  args: {
    sessionId: v.string(),
    flexAuthMode: v.optional(v.union(v.literal('InviteCode'), v.literal('ConvexOAuth'))),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.normalizeId('sessions', args.sessionId);
    if (!sessionId) {
      return false;
    }
    if (args.flexAuthMode === 'InviteCode') {
      return isValidSessionForInviteCode(ctx, { sessionId });
    } else if (args.flexAuthMode === 'ConvexOAuth') {
      const session = await ctx.db.get(sessionId);
      if (!session) {
        return false;
      }
      if (!session.memberId) {
        return false;
      }
      return isValidSessionForConvexOAuth(ctx, { sessionId, memberId: session.memberId });
    }
    return isValidSession(ctx, { sessionId });
  },
});

export const issueInviteCode = internalMutation({
  args: {
    code: v.optional(v.string()),
    issuedReason: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    return await _issueInviteCode(ctx, args);
  },
});

export const issueInviteCodeForPreviewDeployment = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await _issueInviteCode(ctx, { code: 'preview-test', issuedReason: 'Preview deployment' });
  },
});

async function _issueInviteCode(ctx: MutationCtx, args: { code?: string; issuedReason: string }) {
  const code = args.code ?? crypto.randomUUID();
  if (code.length < 3) {
    // so they can be used as the default project name for
    // convexProjects:connectConvexProject
    throw new Error('Invite codes must be at least three letters');
  }

  const existing = await ctx.db
    .query('inviteCodes')
    .withIndex('byCode', (q) => q.eq('code', code))
    .collect();

  if (existing.length > 0) {
    throw new Error('Invite code has already been issued');
  }

  const sessionId = await ctx.db.insert('sessions', {});

  await ctx.db.insert('inviteCodes', {
    sessionId,
    code,
    lastUsedTime: null,
    issuedReason: args.issuedReason,
    isActive: true,
  });

  return code;
}

export const revokeInviteCode = internalMutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const code = args.code ?? crypto.randomUUID();

    const existing = await ctx.db
      .query('inviteCodes')
      .withIndex('byCode', (q) => q.eq('code', code))
      .collect();

    for (const inviteCode of existing) {
      if (inviteCode.isActive) {
        await ctx.db.patch(inviteCode._id, {
          isActive: false,
        });
      }
    }
    console.log(`Revoked ${existing.length} invite codes`, code);
  },
});

export async function isValidSession(ctx: QueryCtx, args: { sessionId: Id<'sessions'> }) {
  const session = await ctx.db.get(args.sessionId);
  if (!session) {
    return false;
  }
  if (session.memberId) {
    return await isValidSessionForConvexOAuth(ctx, { sessionId: args.sessionId, memberId: session.memberId });
  }
  return await isValidSessionForInviteCode(ctx, args);
}

async function isValidSessionForInviteCode(ctx: QueryCtx, args: { sessionId: Id<'sessions'> }) {
  const inviteCode = await ctx.db
    .query('inviteCodes')
    .withIndex('bySessionId', (q) => q.eq('sessionId', args.sessionId))
    .unique();

  return inviteCode !== null && inviteCode.isActive;
}

async function isValidSessionForConvexOAuth(
  ctx: QueryCtx,
  args: { sessionId: Id<'sessions'>; memberId: Id<'convexMembers'> },
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
    sessionId: v.id('sessions'),
    chatId: v.id('chats'),
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
      throw new ConvexError({ code: 'NotAuthorized', message: 'Chat not found' });
    }
    const session = await ctx.db.get(args.sessionId);
    if (!session || !session.memberId) {
      throw new ConvexError({ code: 'NotAuthorized', message: 'Chat not found' });
    }
    await ctx.db.patch(args.chatId, {
      convexProject: {
        kind: 'connected',
        projectSlug: args.projectSlug,
        teamSlug: args.teamSlug,
        deploymentUrl: args.deploymentUrl,
        deploymentName: args.deploymentName,
      },
    });
    const credentials = await ctx.db
      .query('convexProjectCredentials')
      .withIndex('bySlugs', (q) => q.eq('teamSlug', args.teamSlug).eq('projectSlug', args.projectSlug))
      .collect();
    if (credentials.length === 0) {
      await ctx.db.insert('convexProjectCredentials', {
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
  returns: v.id('sessions'),
  handler: async (ctx) => {
    const member = await getOrCreateCurrentMember(ctx);
    const existingSession = await ctx.db
      .query('sessions')
      .withIndex('byMemberId', (q) => q.eq('memberId', member))
      .unique();
    if (existingSession) {
      return existingSession._id;
    }
    return ctx.db.insert('sessions', {
      memberId: member,
    });
  },
});

async function getOrCreateCurrentMember(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ code: 'NotAuthorized', message: 'Unauthorized' });
  }
  const existingMember = await ctx.db
    .query('convexMembers')
    .withIndex('byTokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
    .unique();
  if (existingMember) {
    return existingMember._id;
  }
  return ctx.db.insert('convexMembers', {
    tokenIdentifier: identity.tokenIdentifier,
  });
}

export async function getCurrentMember(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ code: 'NotAuthorized', message: 'Unauthorized' });
  }
  const existingMember = await ctx.db
    .query('convexMembers')
    .withIndex('byTokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
    .unique();
  if (!existingMember) {
    throw new ConvexError({ code: 'NotAuthorized', message: 'Unauthorized' });
  }
  return existingMember;
}

export async function getInviteCode(ctx: QueryCtx, args: { sessionId: Id<'sessions'> }) {
  const inviteCode = await ctx.db
    .query('inviteCodes')
    .withIndex('bySessionId', (q) => q.eq('sessionId', args.sessionId))
    .unique();
  if (inviteCode === null || !inviteCode.isActive) {
    throw new ConvexError({ code: 'NotAuthorized', message: 'Invite code not found' });
  }
  return inviteCode;
}

export const cleanupInactiveSession = internalMutation({
  args: {
    sessionId: v.id('sessions'),
    forReal: v.boolean(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      console.log('Session not found');
      return;
    }
    const chats = await ctx.db
      .query('chats')
      .withIndex('byCreatorAndId', (q) => q.eq('creatorId', session._id))
      .collect();
    console.log(`Found ${chats.length} chats for session ${session._id}`);
    for (const chat of chats) {
      console.log(`Deleting data for chat ${chat._id}`);
      const chatMessages = await ctx.db
        .query('chatMessages')
        .withIndex('byChatId', (q) => q.eq('chatId', chat._id))
        .collect();
      console.log(`Deleting ${chatMessages.length} messages for chat ${chat._id}`);
      for (const chatMessage of chatMessages) {
        await ctx.db.delete(chatMessage._id);
      }
      const connectedProject = chat.convexProject;
      if (connectedProject?.kind === 'connected') {
        console.log(`Chat connected to project with deployment ${connectedProject.deploymentName}`);
        const allCredentials = await ctx.db
          .query('convexProjectCredentials')
          .withIndex('bySlugs', (q) =>
            q.eq('teamSlug', connectedProject.teamSlug).eq('projectSlug', connectedProject.projectSlug),
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
      console.error('Failing transaction since this is a dry run. Set --for-real to true to delete the session.');
      throw new Error('Dry run');
    }
  },
});
