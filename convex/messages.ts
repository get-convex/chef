import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import type { Message as AIMessage } from 'ai';
import { ConvexError, v } from 'convex/values';
import type { Infer, VAny } from 'convex/values';
import { isValidSession } from './sessions';
import type { Doc, Id } from './_generated/dataModel';
import { ensureEnvVar, startProvisionConvexProjectHelper } from './convexProjects';
import { internal } from './_generated/api';

export type SerializedMessage = Omit<AIMessage, 'createdAt' | 'content'> & {
  createdAt: number | undefined;
  content?: string;
};

export const initializeChat = mutation({
  args: {
    sessionId: v.id('sessions'),
    id: v.string(),
    projectInitParams: v.optional(
      v.object({
        teamSlug: v.string(),
        auth0AccessToken: v.string(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { id, sessionId, projectInitParams } = args;
    let existing = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: args.id, sessionId: args.sessionId });

    if (existing) {
      return;
    }

    await createNewChat(ctx, {
      id,
      sessionId,
      projectInitParams,
    });
  },
});

export const addMessages = mutation({
  args: {
    sessionId: v.id('sessions'),
    id: v.string(),
    messages: v.array(v.any() as VAny<SerializedMessage>),
    startIndex: v.optional(v.number()),
    expectedLength: v.number(),
  },
  returns: v.object({
    id: v.string(),
    initialId: v.optional(v.string()),
    urlId: v.optional(v.string()),
    description: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const { id, sessionId, messages, expectedLength, startIndex } = args;

    const existing = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id, sessionId });

    if (!existing) {
      throw new ConvexError({ code: 'NotFound', message: 'Chat not found' });
    }

    return _appendMessagesDb(ctx, {
      sessionId,
      chat: existing,
      messages,
      startIndex,
      expectedLength,
    });
  },
});

export const setUrlId = mutation({
  args: {
    sessionId: v.id('sessions'),
    chatId: v.string(),
    urlHint: v.string(),
    description: v.string(),
  },
  returns: v.object({
    urlId: v.string(),
    initialId: v.string(),
  }),
  handler: async (ctx, args) => {
    const { chatId, urlHint, description } = args;
    const existing = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId: args.sessionId });

    if (!existing) {
      throw new ConvexError({ code: 'NotFound', message: 'Chat not found' });
    }
    if (existing.urlId === undefined) {
      const urlId = await _allocateUrlId(ctx, { urlHint, sessionId: args.sessionId });
      await ctx.db.patch(existing._id, {
        urlId,
        description: existing.description ?? description,
      });
      return { urlId, initialId: existing.initialId };
    }
    return { urlId: existing.urlId, initialId: existing.initialId };
  },
});

export const setDescription = mutation({
  args: {
    sessionId: v.id('sessions'),
    id: v.string(),
    description: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { id, description } = args;
    const existing = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id, sessionId: args.sessionId });

    if (!existing) {
      throw new ConvexError({ code: 'NotFound', message: 'Chat not found' });
    }

    await ctx.db.patch(existing._id, {
      description,
    });
  },
});

export async function getChat(ctx: QueryCtx, id: string, sessionId: Id<'sessions'>) {
  const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id, sessionId });

  if (!chat) {
    return null;
  }

  // Don't send extra fields like `messages` or `creatorId`
  return {
    initialId: chat.initialId,
    urlId: chat.urlId,
    description: chat.description,
    timestamp: chat.timestamp,
    snapshotId: chat.snapshotId,
  };
}

export const get = query({
  args: {
    id: v.string(),
    sessionId: v.id('sessions'),
  },
  returns: v.union(
    v.null(),
    v.object({
      initialId: v.string(),
      urlId: v.optional(v.string()),
      description: v.optional(v.string()),
      timestamp: v.string(),
      snapshotId: v.optional(v.id('_storage')),
    }),
  ),
  handler: async (ctx, args) => {
    const { id, sessionId } = args;
    return await getChat(ctx, id, sessionId);
  },
});

// This exists for compatibility with old clients
export const getInitialMessages = mutation({
  args: {
    sessionId: v.id('sessions'),
    id: v.string(),
    rewindToMessageId: v.optional(v.any()),
  },
  returns: v.union(
    v.null(),
    v.object({
      id: v.string(),
      initialId: v.string(),
      urlId: v.optional(v.string()),
      description: v.optional(v.string()),
      timestamp: v.string(),
      messages: v.array(v.any() as VAny<SerializedMessage>),
    }),
  ),
  handler: async (ctx, args) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: args.id, sessionId: args.sessionId });
    if (!chat) {
      return null;
    }
    const storageInfo = await ctx.db
      .query('chatMessagesStorageState')
      .withIndex('byChatId', (q) => q.eq('chatId', chat._id))
      .unique();
    if (storageInfo !== null) {
      // The data is stored in storage, but the client is on an old version, so crash instead of returning
      // stale data.
      throw new ConvexError({ code: 'UpdateRequired', message: 'Refresh the page to get a newer client version.' });
    }
    return await _getInitialMessages(ctx, args);
  },
});

export const getInitialMessagesInternal = internalQuery({
  args: {
    sessionId: v.id('sessions'),
    id: v.string(),
  },
  returns: v.array(v.any() as VAny<SerializedMessage>),
  handler: async (ctx, args) => {
    const result = await _getInitialMessages(ctx, args);
    if (result === null) {
      return [];
    }
    return result.messages;
  },
});

async function _getInitialMessages(ctx: QueryCtx, args: { id: string; sessionId: Id<'sessions'> }) {
  const { id, sessionId } = args;
  const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id, sessionId });

  if (!chat) {
    return null;
  }

  const chatInfo = {
    id: getIdentifier(chat),
    initialId: chat.initialId,
    urlId: chat.urlId,
    description: chat.description,
    timestamp: chat.timestamp,
  };

  const messages = await ctx.db
    .query('chatMessages')
    .withIndex('byChatId', (q) => q.eq('chatId', chat._id))
    .collect();

  return {
    ...chatInfo,
    messages: messages.map((m) => m.content),
  };
}

const storageInfo = v.object({
  storageId: v.union(v.id('_storage'), v.null()),
  lastMessageRank: v.number(),
  partIndex: v.number(),
});

type StorageInfo = Infer<typeof storageInfo>;

export const getInitialMessagesStorageInfo = internalQuery({
  args: {
    sessionId: v.id('sessions'),
    chatId: v.string(),
  },
  returns: v.union(v.null(), storageInfo),
  handler: async (ctx, args): Promise<StorageInfo | null> => {
    const { chatId, sessionId } = args;
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    if (!chat) {
      return null;
    }
    const doc = await ctx.db
      .query('chatMessagesStorageState')
      .withIndex('byChatId', (q) => q.eq('chatId', chat._id))
      .unique();
    if (!doc) {
      return null;
    }
    return {
      storageId: doc.storageId,
      lastMessageRank: doc.lastMessageRank,
      partIndex: doc.partIndex,
    };
  },
});

export const updateStorageState = internalMutation({
  args: {
    sessionId: v.id('sessions'),
    chatId: v.string(),
    storageId: v.id('_storage'),
    lastMessageRank: v.number(),
    partIndex: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const { chatId, storageId, lastMessageRank, partIndex, sessionId } = args;
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    if (!chat) {
      throw new ConvexError({ code: 'NotFound', message: 'Chat not found' });
    }
    const doc = await ctx.db
      .query('chatMessagesStorageState')
      .withIndex('byChatId', (q) => q.eq('chatId', chat._id))
      .unique();
    if (!doc) {
      throw new Error('Chat messages storage state not found');
    }
    if (doc.lastMessageRank > lastMessageRank) {
      console.warn(
        `Stale update -- stored messages up to ${doc.lastMessageRank} but received update up to ${lastMessageRank}`,
      );
      return;
    }
    if (doc.lastMessageRank === lastMessageRank && doc.partIndex > partIndex) {
      console.warn(
        `Stale update -- stored parts in message ${doc.lastMessageRank} up to part ${doc.partIndex} but received update up to part ${partIndex}`,
      );
      return;
    }
    await ctx.db.patch(doc._id, {
      storageId,
      lastMessageRank,
      partIndex,
    });
    if (doc.storageId !== null) {
      await ctx.scheduler.runAfter(0, internal.messages.maybeCleanupStaleChatHistory, {
        storageId: doc.storageId,
      });
    }
  },
});

export const maybeCleanupStaleChatHistory = internalMutation({
  args: {
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args): Promise<void> => {
    const chatRef = await ctx.db
      .query('chatMessagesStorageState')
      .withIndex('byStorageId', (q) => q.eq('storageId', args.storageId))
      .first();
    if (chatRef !== null) {
      return;
    }

    const shareRef = await ctx.db
      .query('shares')
      .withIndex('byChatHistoryId', (q) => q.eq('chatHistoryId', args.storageId))
      .first();
    if (shareRef !== null) {
      return;
    }

    await ctx.storage.delete(args.storageId);
  },
});

export const handleStorageStateMigration = internalMutation({
  args: {
    sessionId: v.id('sessions'),
    chatId: v.string(),
    storageId: v.id('_storage'),
    lastMessageRank: v.number(),
    partIndex: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const { chatId, storageId, lastMessageRank, partIndex, sessionId } = args;
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    if (!chat) {
      throw new ConvexError({ code: 'NotFound', message: 'Chat not found' });
    }
    const doc = await ctx.db
      .query('chatMessagesStorageState')
      .withIndex('byChatId', (q) => q.eq('chatId', chat._id))
      .unique();
    if (doc) {
      throw new Error('Chat messages storage state already exists');
    }
    await ctx.db.insert('chatMessagesStorageState', {
      chatId: chat._id,
      storageId,
      lastMessageRank,
      partIndex,
    });
    await ctx.scheduler.runAfter(0, internal.messages.cleanupChatMessages, {
      chatId: chat._id,
      assertStorageStateExists: true,
    });
  },
});

export const getAll = query({
  args: {
    sessionId: v.id('sessions'),
  },
  returns: v.array(
    v.object({
      id: v.string(),
      initialId: v.string(),
      urlId: v.optional(v.string()),
      description: v.optional(v.string()),
      timestamp: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const { sessionId } = args;
    const results = await ctx.db
      .query('chats')
      .withIndex('byCreatorAndUrlId', (q) => q.eq('creatorId', sessionId))
      .collect();

    return results.map((result) => ({
      id: getIdentifier(result),
      initialId: result.initialId,
      urlId: result.urlId,
      description: result.description,
      timestamp: result.timestamp,
    }));
  },
});

export const remove = action({
  args: {
    sessionId: v.id('sessions'),
    id: v.string(),
    teamSlug: v.optional(v.string()),
    projectSlug: v.optional(v.string()),
    shouldDeleteConvexProject: v.boolean(),
    accessToken: v.string(),
  },
  handler: async (ctx, args) => {
    const { accessToken, id, sessionId, teamSlug, projectSlug, shouldDeleteConvexProject } = args;
    let projectDeletionResult: { kind: 'success' } | { kind: 'error'; error: string } = { kind: 'success' };
    if (shouldDeleteConvexProject) {
      projectDeletionResult = await tryDeleteProject({ teamSlug, projectSlug, accessToken });
    }

    await ctx.runMutation(internal.messages.removeChatInner, {
      id,
      sessionId,
    });

    if (projectDeletionResult.kind === 'error') {
      return {
        kind: 'error',
        error: `Deleted chat, but failed to delete linked Convex project:\n${projectDeletionResult.error}`,
      };
    }
    return { kind: 'success' };
  },
});

async function tryDeleteProject(args: {
  teamSlug: string | undefined;
  projectSlug: string | undefined;
  accessToken: string;
}): Promise<{ kind: 'success' } | { kind: 'error'; error: string }> {
  const { teamSlug, projectSlug, accessToken } = args;
  if (teamSlug === undefined || projectSlug === undefined) {
    return { kind: 'error', error: 'Team slug and project slug are required to delete a Convex project' };
  }

  const bigBrainHost = ensureEnvVar('BIG_BRAIN_HOST');

  const projectsResponse = await fetch(`${bigBrainHost}/api/teams/${teamSlug}/projects`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!projectsResponse.ok) {
    const text = await projectsResponse.text();
    try {
      const error = JSON.parse(text);
      if (error.code === 'TeamNotFound') {
        return { kind: 'error', error: `Team not found: ${teamSlug}` };
      }
      return { kind: 'error', error: `Failed to fetch team projects: ${projectsResponse.statusText} ${text}` };
    } catch (_e) {
      return { kind: 'error', error: `Failed to fetch team projects: ${projectsResponse.statusText} ${text}` };
    }
  }

  const projects = await projectsResponse.json();
  const project = projects.find((p: any) => p.slug === projectSlug);

  if (project) {
    const response = await fetch(`${bigBrainHost}/api/dashboard/delete_project/${project.id}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return { kind: 'error', error: `Failed to delete project: ${response.statusText} ${text}` };
    }
  }

  return { kind: 'success' };
}

export const removeChatInner = internalMutation({
  args: {
    id: v.string(),
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const existing = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: args.id, sessionId: args.sessionId });

    if (!existing) {
      return;
    }

    // This doesn't delete the snapshot, and it also will break if the chat was ever shared.
    // We might want soft deletion instead, but for now, let's just delete more stuff.
    const storageState = await ctx.db
      .query('chatMessagesStorageState')
      .withIndex('byChatId', (q) => q.eq('chatId', existing._id))
      .unique();
    if (storageState === null) {
      await ctx.scheduler.runAfter(0, internal.messages.cleanupChatMessages, {
        chatId: existing._id,
        assertStorageStateExists: false,
      });
    } else {
      if (storageState.storageId !== null) {
        await ctx.scheduler.runAfter(0, internal.messages.maybeCleanupStaleChatHistory, {
          storageId: storageState.storageId,
        });
      }
      await ctx.db.delete(storageState._id);
    }
    const convexProject = existing.convexProject;
    if (convexProject !== undefined && convexProject.kind === 'connected') {
      const credentials = await ctx.db
        .query('convexProjectCredentials')
        .withIndex('bySlugs', (q) =>
          q.eq('teamSlug', convexProject.teamSlug).eq('projectSlug', convexProject.projectSlug),
        )
        .unique();
      if (credentials !== null) {
        await ctx.db.delete(credentials._id);
      }
    }
    await ctx.db.delete(existing._id);
  },
});

export const cleanupChatMessages = internalMutation({
  args: {
    chatId: v.id('chats'),
    assertStorageStateExists: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { chatId, assertStorageStateExists } = args;
    if (assertStorageStateExists) {
      const storageState = await ctx.db
        .query('chatMessagesStorageState')
        .withIndex('byChatId', (q) => q.eq('chatId', chatId))
        .unique();
      if (storageState === null) {
        throw new Error(
          'Chat messages storage state not found -- should not clean up messages from DB if they are not stored',
        );
      }
    }
    const messages = await ctx.db
      .query('chatMessages')
      .withIndex('byChatId', (q) => q.eq('chatId', chatId))
      .collect();
    for (const message of messages) {
      // Soft delete for now, and we'll follow up with hard delete later.
      await ctx.db.patch(message._id, {
        deletedAt: Date.now(),
      });
    }
  },
});

/*
 * Update the last message in the chat (if the `id`s match), and append any new messages.
 */
async function _appendMessagesDb(
  ctx: MutationCtx,
  args: {
    sessionId: Id<'sessions'>;
    chat: Doc<'chats'>;
    messages: SerializedMessage[];
    expectedLength?: number;
    startIndex?: number;
  },
) {
  if (args.messages.length === 0) {
    return {
      id: getIdentifier(args.chat),
      description: args.chat.description,
    };
  }

  const { chat, messages, expectedLength, startIndex } = args;

  if (chat.urlId === undefined) {
    for (const message of messages) {
      const artifactIdAndTitle = extractArtifactIdAndTitle(message);

      if (artifactIdAndTitle) {
        const urlId = await _allocateUrlId(ctx, { urlHint: artifactIdAndTitle.id, sessionId: args.sessionId });
        await ctx.db.patch(chat._id, {
          urlId,
          description: artifactIdAndTitle.title,
        });
        break;
      }
    }
  }
  const storageState = await ctx.db
    .query('chatMessagesStorageState')
    .withIndex('byChatId', (q) => q.eq('chatId', chat._id))
    .unique();
  if (storageState === null) {
    throw new Error('Chat messages should be stored in storage');
  }

  const lastMessage = await ctx.db
    .query('chatMessages')
    .withIndex('byChatId', (q) => q.eq('chatId', chat._id))
    .order('desc')
    .first();

  let rank = startIndex !== undefined ? startIndex : lastMessage ? lastMessage.rank + 1 : 0;

  const persistedMessages = await ctx.db
    .query('chatMessages')
    .withIndex('byChatId', (q) => q.eq('chatId', chat._id).gte('rank', rank))
    .collect();
  for (let i = 0; i < messages.length; i++) {
    const existingMessage = persistedMessages.find((m) => m.rank === rank);
    await upsertChatMessage(ctx, {
      existingMessageId: existingMessage?._id ?? null,
      chatId: chat._id,
      rank,
      message: messages[i],
    });
    rank++;
  }

  if (expectedLength !== undefined && rank !== expectedLength) {
    console.error('Expected length mismatch', rank, expectedLength);
  }

  const updatedId = getIdentifier(chat);
  const updatedDescription = chat.description;

  return {
    id: updatedId,
    initialId: chat.initialId,
    urlId: chat.urlId,
    description: updatedDescription,
  };
}

async function upsertChatMessage(
  ctx: MutationCtx,
  args: {
    existingMessageId: Id<'chatMessages'> | null;
    chatId: Id<'chats'>;
    rank: number;
    message: SerializedMessage;
  },
) {
  const { existingMessageId, chatId, rank, message } = args;

  if (shouldLogMessageSize()) {
    logMessageSize(message, 'upsertChatMessage');
  }

  try {
    if (existingMessageId) {
      await ctx.db.patch(existingMessageId, {
        content: message,
      });
    } else {
      await ctx.db.insert('chatMessages', {
        chatId,
        content: message,
        rank,
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Value is too large')) {
      logMessageSize(message, 'upsertChatMessage -- too large');
    }
    throw error;
  }
}

function extractArtifactIdAndTitle(message: SerializedMessage) {
  /*
   * This replicates the original bolt.diy behavior of client-side assigning a URL + description
   * based on the first artifact registered.
   *
   * I suspect there's a bug somewhere here since the first artifact tends to be named "imported-files"
   *
   * Example: <boltArtifact id="imported-files" title="Interactive Tic Tac Toe Game"
   */
  const content =
    message.parts
      ?.filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('') ?? '';

  const match = content.match(/<boltArtifact id="([^"]+)" title="([^"]+)"/);

  return match ? { id: match[1], title: match[2] } : null;
}

async function _allocateUrlId(ctx: QueryCtx, { urlHint, sessionId }: { urlHint: string; sessionId: Id<'sessions'> }) {
  const existing = await getChatByUrlId(ctx, { id: urlHint, sessionId });

  if (existing === null) {
    return urlHint;
  }

  let i = 2;

  while (true) {
    const newUrlId = `${urlHint}-${i}`;

    const m = await getChatByUrlId(ctx, { id: newUrlId, sessionId });

    if (m === null) {
      return newUrlId;
    }

    i++;
  }
}

export async function createNewChat(
  ctx: MutationCtx,
  args: {
    id: string;
    sessionId: Id<'sessions'>;
    projectInitParams?: {
      teamSlug: string;
      auth0AccessToken: string;
    };
  },
): Promise<Id<'chats'>> {
  const { id, sessionId, projectInitParams } = args;
  const existing = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id, sessionId });

  if (existing) {
    throw new ConvexError({ code: 'InvalidState', message: 'Chat already exists' });
  }

  const session = await ctx.db.get(sessionId);
  if (!session) {
    throw new Error(`Invalid state -- session should exist: ${sessionId}`);
  }

  const chatId = await ctx.db.insert('chats', {
    creatorId: sessionId,
    initialId: id,
    timestamp: new Date().toISOString(),
  });
  await ctx.db.insert('chatMessagesStorageState', {
    chatId,
    storageId: null,
    lastMessageRank: -1,
    partIndex: -1,
  });

  await startProvisionConvexProjectHelper(ctx, {
    sessionId,
    chatId: id,
    projectInitParams,
  });

  return chatId;
}

function getChatByInitialId(ctx: QueryCtx, { id, sessionId }: { id: string; sessionId: Id<'sessions'> }) {
  return ctx.db
    .query('chats')
    .withIndex('byCreatorAndId', (q) => q.eq('creatorId', sessionId).eq('initialId', id))
    .unique();
}

function getChatByUrlId(ctx: QueryCtx, { id, sessionId }: { id: string; sessionId: Id<'sessions'> }) {
  return ctx.db
    .query('chats')
    .withIndex('byCreatorAndUrlId', (q) => q.eq('creatorId', sessionId).eq('urlId', id))
    .unique();
}

export async function getChatByIdOrUrlIdEnsuringAccess(
  ctx: QueryCtx,
  { id, sessionId }: { id: string; sessionId: Id<'sessions'> },
) {
  const isValid = await isValidSession(ctx, { sessionId });
  if (!isValid) {
    return null;
  }

  const byId = await getChatByInitialId(ctx, { id, sessionId });
  if (byId !== null) {
    return byId;
  }

  const byUrlId = await getChatByUrlId(ctx, { id, sessionId });
  return byUrlId;
}

function getIdentifier(chat: Doc<'chats'>): string {
  return chat.urlId ?? chat.initialId!;
}

/**
 * Utility function to log details about the size of SerializedMessage objects
 */
function logMessageSize(message: SerializedMessage, context: string) {
  const messageSize = JSON.stringify(message).length;
  const partsSize = message.parts ? JSON.stringify(message.parts).length : 0;
  const contentSize = message.content ? message.content.length : 0;

  console.log(`[Message Size Debug] ${context}:
    Total size: ${messageSize} bytes
    Parts size: ${partsSize} bytes
    Content size: ${contentSize} bytes
    Has parts: ${!!message.parts}
    Parts count: ${message.parts?.length || 0}
    Role: ${message.role}
    ID: ${message.id}
  `);

  // Log details about each part if they exist
  if (message.parts && message.parts.length > 0) {
    message.parts.forEach((part, index) => {
      // For text parts, log the length of the text
      if (part.type === 'text') {
        console.log(`    Text length: ${part.text.length} chars`);
      } else {
        const partSize = JSON.stringify(part).length;
        console.log(`  Part ${index} (${part.type}): ${partSize} bytes`);
      }
    });
  }
}

function shouldLogMessageSize() {
  const shouldLogFraction = parseFloat(process.env.SHOULD_LOG_MESSAGE_SIZE_FRACTION ?? '0.1');
  if (Number.isNaN(shouldLogFraction)) {
    console.error('SHOULD_LOG_MESSAGE_SIZE_FRACTION is not a number', process.env.SHOULD_LOG_MESSAGE_SIZE_FRACTION);
    return false;
  }
  return Math.random() < shouldLogFraction;
}
