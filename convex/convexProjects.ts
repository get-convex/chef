import { internalAction, internalMutation, mutation, query } from './_generated/server';
import { ConvexError, v } from 'convex/values';
import { getChatByIdOrUrlIdEnsuringAccess } from './messages';
import { internal } from './_generated/api';
import { getCurrentMember, getInviteCode } from './sessions';

export const hasConnectedConvexProject = query({
  args: {
    sessionId: v.id('sessions'),
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: args.chatId, sessionId: args.sessionId });
    return chat?.convexProject !== undefined;
  },
});

export const loadConnectedConvexProjectInfo = query({
  args: {
    sessionId: v.id('sessions'),
    chatId: v.string(),
  },
  returns: v.union(
    v.object({
      projectSlug: v.string(),
      teamSlug: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: args.chatId, sessionId: args.sessionId });
    if (!chat) {
      throw new ConvexError({ code: 'NotAuthorized', message: 'Chat not found' });
    }
    if (chat.convexProject?.kind !== 'connected') {
      return null;
    }
    return {
      projectSlug: chat.convexProject.projectSlug,
      teamSlug: chat.convexProject.teamSlug,
    };
  },
});

export const loadConnectedConvexProjectCredentials = query({
  args: {
    sessionId: v.id('sessions'),
    chatId: v.string(),
  },
  returns: v.union(
    v.object({
      kind: v.literal('connected'),
      projectSlug: v.string(),
      teamSlug: v.string(),
      deploymentUrl: v.string(),
      deploymentName: v.string(),
      adminKey: v.string(),
    }),
    v.object({
      kind: v.literal('connecting'),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: args.chatId, sessionId: args.sessionId });
    if (!chat) {
      return null;
    }
    const project = chat.convexProject;
    if (project === undefined) {
      return null;
    }
    if (project.kind === 'connecting') {
      return { kind: 'connecting' } as const;
    }
    const credentials = await ctx.db
      .query('convexProjectCredentials')
      .withIndex('bySlugs', (q) => q.eq('teamSlug', project.teamSlug).eq('projectSlug', project.projectSlug))
      .first();
    if (!credentials) {
      throw new ConvexError({ code: 'NotAuthorized', message: 'Credentials not found' });
    }
    return {
      kind: 'connected',
      projectSlug: project.projectSlug,
      teamSlug: project.teamSlug,
      deploymentUrl: project.deploymentUrl,
      deploymentName: project.deploymentName,
      adminKey: credentials.projectDeployKey,
    } as const;
  },
});

export const startProvisionConvexProject = mutation({
  args: {
    sessionId: v.id('sessions'),
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: args.chatId, sessionId: args.sessionId });
    if (!chat) {
      throw new ConvexError({ code: 'NotAuthorized', message: 'Chat not found' });
    }
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      console.error(`Session not found: ${args.sessionId}`);
      throw new ConvexError({ code: 'NotAuthorized', message: 'Chat not found' });
    }
    if (session.memberId !== undefined) {
      console.error(
        `This flow is only available with invite codes but is being used for the oauth flow: ${args.sessionId}`,
      );
      throw new ConvexError({ code: 'NotAuthorized', message: 'Invalid flow for connecting a project' });
    }

    await ctx.db.patch(chat._id, { convexProject: { kind: 'connecting' } });
    const inviteCode = await getInviteCode(ctx, { sessionId: args.sessionId });
    const projectName = chat.urlId ?? inviteCode.code;
    await ctx.scheduler.runAfter(0, internal.convexProjects.connectConvexProject, {
      sessionId: args.sessionId,
      chatId: args.chatId,
      projectName,
    });
  },
});

export const recordProvisionedConvexProjectCredentials = internalMutation({
  args: {
    sessionId: v.id('sessions'),
    chatId: v.string(),
    projectSlug: v.string(),
    projectDeployKey: v.string(),
    deploymentUrl: v.string(),
    deploymentName: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('convexProjectCredentials', {
      projectSlug: args.projectSlug,
      teamSlug: 'demo-team',
      projectDeployKey: args.projectDeployKey,
    });
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: args.chatId, sessionId: args.sessionId });
    if (!chat) {
      console.error(`Chat not found: ${args.chatId}, sessionId: ${args.sessionId}`);
      return;
    }
    await ctx.db.patch(chat._id, {
      convexProject: {
        kind: 'connected',
        projectSlug: args.projectSlug,
        teamSlug: 'demo-team',
        deploymentUrl: args.deploymentUrl,
        deploymentName: args.deploymentName,
      },
    });
  },
});
export const registerConvexProjectViaOauth = mutation({
  args: {
    sessionId: v.id('sessions'),
    chatId: v.string(),
    token: v.string(),
    deploymentName: v.string(),
    deploymentUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: args.chatId, sessionId: args.sessionId });
    if (!chat) {
      throw new ConvexError({ code: 'NotAuthorized', message: 'Chat not found' });
    }
    const member = await getCurrentMember(ctx);
    // We should really assert that these match the key
    const { projectSlug, teamSlug, projectDeployKey } = parseToken(args.token);
    await ctx.db.patch(chat._id, {
      convexProject: {
        kind: 'connected',
        projectSlug,
        teamSlug,
        deploymentUrl: args.deploymentUrl,
        deploymentName: args.deploymentName,
      },
    });
    const allCredentialsForProject = await ctx.db
      .query('convexProjectCredentials')
      .withIndex('bySlugs', (q) => q.eq('teamSlug', teamSlug).eq('projectSlug', projectSlug))
      .collect();
    const existingCredential = allCredentialsForProject.find((c) => c.memberId === member._id);
    if (!existingCredential) {
      await ctx.db.insert('convexProjectCredentials', {
        projectSlug,
        teamSlug,
        memberId: member._id,
        projectDeployKey,
      });
    } else {
      await ctx.db.patch(existingCredential._id, {
        projectDeployKey,
      });
    }
  },
});

function parseToken(token: string) {
  // project:teamSlug:projectSlug|<secret>
  const parts = token.split('|');
  if (parts.length !== 2) {
    throw new ConvexError({ code: 'InvalidToken', message: 'Invalid token' });
  }
  const firstParts = parts[0].split(':');
  if (firstParts.length !== 3) {
    throw new ConvexError({ code: 'InvalidToken', message: 'Invalid token' });
  }
  return {
    projectSlug: firstParts[2],
    teamSlug: firstParts[1],
    projectDeployKey: token,
  };
}

export const connectConvexProject = internalAction({
  args: {
    sessionId: v.id('sessions'),
    projectName: v.string(),
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    const bigBrainHost = ensureEnvVar('BIG_BRAIN_HOST');
    const bigBrainApiKey = ensureEnvVar('BIG_BRAIN_API_KEY');
    const teamSlug = ensureEnvVar('DEMO_TEAM_SLUG');

    const response = await fetch(`${bigBrainHost}/api/create_project`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bigBrainApiKey}`,
      },
      body: JSON.stringify({
        team: teamSlug,
        projectName: args.projectName,
        deploymentType: 'dev',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to create project: ${response.statusText} ${text}`);
    }

    const data: {
      projectSlug: string;
      projectId: number;
      teamSlug: string;
      deploymentName: string;
      // This is in fact the dev URL
      prodUrl: string;
      projectsRemaining: number;
      adminKey: string;
    } = await response.json();

    await ctx.runMutation(internal.convexProjects.recordProvisionedConvexProjectCredentials, {
      sessionId: args.sessionId,
      chatId: args.chatId,
      projectSlug: data.projectSlug,
      projectDeployKey: data.adminKey,
      deploymentUrl: data.prodUrl,
      deploymentName: data.deploymentName,
    });
  },
});

export const disconnectConvexProject = mutation({
  args: {
    sessionId: v.id('sessions'),
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: args.chatId, sessionId: args.sessionId });
    if (!chat) {
      throw new ConvexError({ code: 'NotAuthorized', message: 'Chat not found' });
    }
    await ctx.db.patch(chat._id, { convexProject: undefined });
  },
});

function ensureEnvVar(name: string) {
  if (!process.env[name]) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return process.env[name];
}
