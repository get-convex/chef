import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
} from './_generated/server';
import { ConvexError, v } from 'convex/values';
import { getChatByIdOrUrlIdEnsuringAccess } from './messages';
import { internal } from './_generated/api';
import { getCurrentMember, getInviteCode } from './sessions';
import type { Id } from './_generated/dataModel';

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
      warningMessage: v.optional(v.string()),
    }),
    v.object({
      kind: v.literal('connecting'),
    }),
    v.object({
      kind: v.literal('failed'),
      errorMessage: v.string(),
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
    if (project.kind === 'failed') {
      return { kind: 'failed', errorMessage: project.errorMessage } as const;
    }
    const credentials = await ctx.db
      .query('convexProjectCredentials')
      .withIndex('bySlugs', (q) => q.eq('teamSlug', project.teamSlug).eq('projectSlug', project.projectSlug))
      .first();
    if (!credentials) {
      return null;
    }
    return {
      kind: 'connected',
      projectSlug: project.projectSlug,
      teamSlug: project.teamSlug,
      deploymentUrl: project.deploymentUrl,
      deploymentName: project.deploymentName,
      adminKey: credentials.projectDeployKey,
      warningMessage: project.warningMessage,
    } as const;
  },
});

const CHECK_CONNECTION_DEADLINE_MS = 15000;

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
    await startProvisionConvexProjectHelper(ctx, args);
  },
});

export async function startProvisionConvexProjectHelper(
  ctx: MutationCtx,
  args: {
    sessionId: Id<'sessions'>;
    chatId: string;
    projectInitParams?: {
      teamSlug: string;
      auth0AccessToken: string;
    };
  },
) {
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
    const jobId = await ctx.scheduler.runAfter(CHECK_CONNECTION_DEADLINE_MS, internal.convexProjects.checkConnection, {
      sessionId: args.sessionId,
      chatId: args.chatId,
    });
    await ctx.db.patch(chat._id, { convexProject: { kind: 'connecting', checkConnectionJobId: jobId } });
    return;
  }

  // Invite code flow
  const inviteCode = await getInviteCode(ctx, { sessionId: args.sessionId });
  const projectName = chat.urlId ?? inviteCode.code;
  await ctx.scheduler.runAfter(0, internal.convexProjects.connectConvexProjectForInviteCode, {
    sessionId: args.sessionId,
    chatId: args.chatId,
    projectName,
  });
  const jobId = await ctx.scheduler.runAfter(CHECK_CONNECTION_DEADLINE_MS, internal.convexProjects.checkConnection, {
    sessionId: args.sessionId,
    chatId: args.chatId,
  });
  await ctx.db.patch(chat._id, { convexProject: { kind: 'connecting', checkConnectionJobId: jobId } });
}

export const recordProvisionedConvexProjectCredentials = internalMutation({
  args: {
    sessionId: v.id('sessions'),
    chatId: v.string(),
    projectSlug: v.string(),
    teamSlug: v.optional(v.string()),
    projectDeployKey: v.string(),
    deploymentUrl: v.string(),
    deploymentName: v.string(),
    warningMessage: v.optional(v.string()),
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
        warningMessage: args.warningMessage,
      },
    });
  },
});

const TOTAL_WAIT_TIME_MS = 5000;
const WAIT_TIME_MS = 500;

export const connectConvexProjectForOauth = internalAction({
  args: {
    sessionId: v.id('sessions'),
    chatId: v.string(),
    accessToken: v.string(),
    teamSlug: v.string(),
  },
  handler: async (ctx, args) => {
    await _connectConvexProjectForMember(ctx, {
      sessionId: args.sessionId,
      chatId: args.chatId,
      accessToken: args.accessToken,
      teamSlug: args.teamSlug,
    })
      .then(async (data) => {
        await ctx.runMutation(internal.convexProjects.recordProvisionedConvexProjectCredentials, {
          sessionId: args.sessionId,
          chatId: args.chatId,
          projectSlug: data.projectSlug,
          teamSlug: args.teamSlug,
          projectDeployKey: data.projectDeployKey,
          deploymentUrl: data.deploymentUrl,
          deploymentName: data.deploymentName,
          warningMessage: data.warningMessage,
        });
      })
      .catch(async (error) => {
        console.error(`Error connecting convex project: ${error.message}`);
        const errorMessage = error instanceof ConvexError ? error.data.message : 'Unexpected error';
        await ctx.runMutation(internal.convexProjects.recordFailedConvexProjectConnection, {
          sessionId: args.sessionId,
          chatId: args.chatId,
          errorMessage,
        });
      });
  },
});

async function _connectConvexProjectForMember(
  ctx: ActionCtx,
  args: {
    sessionId: Id<'sessions'>;
    chatId: string;
    accessToken: string;
    teamSlug: string;
  },
) {
  const bigBrainHost = ensureEnvVar('BIG_BRAIN_HOST');
  let projectName: string | null = null;
  let timeElapsed = 0;
  // Project names get set via the first message from the LLM, so best effort
  // get the name and use it to create the project.
  while (timeElapsed < TOTAL_WAIT_TIME_MS) {
    projectName = await ctx.runQuery(internal.convexProjects.getProjectName, {
      sessionId: args.sessionId,
      chatId: args.chatId,
    });
    if (projectName) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, WAIT_TIME_MS));
    timeElapsed += WAIT_TIME_MS;
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
    const defaultProvisioningError = new ConvexError({
      code: 'ProvisioningError',
      message: `Failed to create project: ${response.status}`,
      details: text,
    });
    if (response.status !== 400) {
      throw defaultProvisioningError;
    }
    let data: { code?: string; message?: string } | null = null;
    try {
      data = JSON.parse(text);
    } catch (_e) {
      throw defaultProvisioningError;
    }

    // Special case this error since it's probably semi-common
    if (data !== null && data.code === 'ProjectQuotaReached' && typeof data.message === 'string') {
      throw new ConvexError({
        code: 'ProvisioningError',
        message: `Failed to create project: ProjectQuotaReached: ${data.message}`,
        details: text,
      });
    }
    throw defaultProvisioningError;
  }
  const data: {
    projectSlug: string;
    projectId: number;
    teamSlug: string;
    deploymentName: string;
    // This is in fact the dev URL
    prodUrl: string;
    adminKey: string;
    projectsRemaining: number;
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
    throw new ConvexError({
      code: 'ProvisioningError',
      message: `Failed to create project deploy key: ${projectDeployKeyResponse.status}`,
      details: text,
    });
  }
  const projectDeployKeyData: { accessToken: string } = await projectDeployKeyResponse.json();
  const projectDeployKey = `project:${args.teamSlug}:${data.projectSlug}|${projectDeployKeyData.accessToken}`;
  const warningMessage =
    data.projectsRemaining <= 2 ? `You have ${data.projectsRemaining} projects remaining on this team.` : undefined;

  return {
    projectSlug: data.projectSlug,
    teamSlug: args.teamSlug,
    deploymentUrl: data.prodUrl,
    deploymentName: data.deploymentName,
    projectDeployKey,
    warningMessage,
  };
}

export const recordFailedConvexProjectConnection = internalMutation({
  args: {
    sessionId: v.id('sessions'),
    chatId: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: args.chatId, sessionId: args.sessionId });
    if (!chat) {
      throw new ConvexError({ code: 'NotAuthorized', message: 'Chat not found' });
    }
    await ctx.db.patch(chat._id, {
      convexProject: { kind: 'failed', errorMessage: args.errorMessage },
    });
  },
});

export const checkConnection = internalMutation({
  args: {
    sessionId: v.id('sessions'),
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: args.chatId, sessionId: args.sessionId });
    if (!chat) {
      throw new ConvexError({ code: 'NotAuthorized', message: 'Chat not found' });
    }
    if (chat.convexProject?.kind !== 'connecting') {
      return;
    }
    await ctx.db.patch(chat._id, { convexProject: { kind: 'failed', errorMessage: 'Failed to connect to project' } });
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
