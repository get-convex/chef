import { internalAction, internalMutation, internalQuery, mutation, query } from './_generated/server';
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
    projectInitParams: v.optional(
      v.object({
        teamSlug: v.string(),
        auth0AccessToken: v.string(),
      }),
    ),
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
      // OAuth flow
      if (args.projectInitParams === undefined) {
        console.error(`Must provide projectInitParams for oauth: ${args.sessionId}`);
        throw new ConvexError({ code: 'NotAuthorized', message: 'Invalid flow for connecting a project' });
      }
      await ctx.scheduler.runAfter(0, internal.convexProjects.connectConvexProjectForOauth, {
        sessionId: args.sessionId,
        chatId: args.chatId,
        accessToken: args.projectInitParams.auth0AccessToken,
        teamSlug: args.projectInitParams.teamSlug,
      });
      return;
    }

    // Invite code flow

    await ctx.db.patch(chat._id, { convexProject: { kind: 'connecting' } });
    const inviteCode = await getInviteCode(ctx, { sessionId: args.sessionId });
    const projectName = chat.urlId ?? inviteCode.code;
    await ctx.scheduler.runAfter(0, internal.convexProjects.connectConvexProjectForInviteCode, {
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
    teamSlug: v.optional(v.string()),
    projectDeployKey: v.string(),
    deploymentUrl: v.string(),
    deploymentName: v.string(),
  },
  handler: async (ctx, args) => {
    const teamSlug = args.teamSlug ?? 'demo-team';
    await ctx.db.insert('convexProjectCredentials', {
      projectSlug: args.projectSlug,
      teamSlug,
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
        teamSlug,
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

export const connectConvexProjectForOauth = internalAction({
  args: {
    sessionId: v.id('sessions'),
    chatId: v.string(),
    accessToken: v.string(),
    teamSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const bigBrainHost = ensureEnvVar('BIG_BRAIN_HOST');
    let projectName: string | null = null;
    let attempts = 0;
    while (attempts < 10) {
      console.log('Waiting!');
      projectName = await ctx.runQuery(internal.convexProjects.getProjectName, {
        sessionId: args.sessionId,
        chatId: args.chatId,
      });
      if (projectName) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
      attempts++;
    }
    projectName = projectName ?? 'My Project (Chef)';
    const response = await fetch(`${bigBrainHost}/api/create_project`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${args.accessToken}`,
      },
      body: JSON.stringify({
        team: args.teamSlug,
        projectName,
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
      adminKey: string;
    } = await response.json();

    const projectDeployKeyResponse = await fetch(`${bigBrainHost}/api/dashboard/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${args.accessToken}`,
      },
      body: JSON.stringify({
        authn_token: args.accessToken,
        projectId: data.projectId,
        appName: ensureEnvVar('CHEF_OAUTH_APP_NAME'),
      }),
    });
    if (!projectDeployKeyResponse.ok) {
      const text = await projectDeployKeyResponse.text();
      throw new Error(`Failed to create project deploy key: ${projectDeployKeyResponse.statusText} ${text}`);
    }
    const projectDeployKeyData: { accessToken: string } = await projectDeployKeyResponse.json();
    const projectDeployKey = projectDeployKeyData.accessToken;

    await ctx.runMutation(internal.convexProjects.recordProvisionedConvexProjectCredentials, {
      sessionId: args.sessionId,
      chatId: args.chatId,
      projectSlug: data.projectSlug,
      teamSlug: args.teamSlug,
      projectDeployKey,
      deploymentUrl: data.prodUrl,
      deploymentName: data.deploymentName,
    });
  },
});

export const getProjectName = internalQuery({
  args: {
    sessionId: v.id('sessions'),
    chatId: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: args.chatId, sessionId: args.sessionId });
    if (!chat) {
      throw new ConvexError({ code: 'NotAuthorized', message: 'Chat not found' });
    }
    return chat.urlId ?? null;
  },
});

export const connectConvexProjectForInviteCode = internalAction({
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
