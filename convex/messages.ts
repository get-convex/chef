import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import type { Message as AIMessage } from 'ai';
import { ConvexError, v } from 'convex/values';
import type { VAny } from 'convex/values';
import { isValidSession } from './sessions';
import type { Doc, Id } from './_generated/dataModel';
import { startProvisionConvexProjectHelper } from './convexProjects';
export type SerializedMessage = Omit<AIMessage, 'createdAt'> & {
  createdAt: number | undefined;
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

    if (!existing) {
      await createNewChatFromMessages(ctx, {
        id,
        sessionId,
        projectInitParams,
      });

      existing = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id, sessionId });

      if (!existing) {
        throw new ConvexError({ code: 'NotFound', message: 'Chat not found' });
      }
    }
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

    return _appendMessages(ctx, {
      sessionId,
      chat: existing,
      messages,
      startIndex,
      expectedLength,
    });
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

export const getInitialMessages = mutation({
  args: {
    sessionId: v.id('sessions'),
    id: v.string(),
    rewindToMessageId: v.union(v.string(), v.null()),
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
    const { id, rewindToMessageId, sessionId } = args;
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

    if (!rewindToMessageId) {
      return {
        ...chatInfo,
        messages: messages.map((m) => m.content),
      };
    }

    const messageIndex = messages.findIndex((msg) => msg.content.id === rewindToMessageId);

    if (messageIndex === -1) {
      console.error('Message to rewind to not found', rewindToMessageId);
      return {
        ...chatInfo,
        messages: messages.map((m) => m.content),
      };
    }

    for (const message of messages.slice(messageIndex + 1)) {
      await ctx.db.delete(message._id);
    }

    return {
      ...chatInfo,
      messages: messages.slice(0, messageIndex + 1).map((m) => m.content),
    };
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

export const remove = mutation({
  args: {
    id: v.string(),
    sessionId: v.id('sessions'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { id, sessionId } = args;
    const existing = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id, sessionId });

    if (!existing) {
      return;
    }

    await ctx.db.delete(existing._id);
  },
});

/*
 * Update the last message in the chat (if the `id`s match), and append any new messages.
 */
async function _appendMessages(
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
    if (existingMessage) {
      await ctx.db.patch(existingMessage._id, {
        content: messages[i],
      });
    } else {
      await ctx.db.insert('chatMessages', {
        chatId: chat._id,
        content: messages[i],
        rank,
      });
    }
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

function extractArtifactIdAndTitle(message: SerializedMessage) {
  /*
   * This replicates the original bolt.diy behavior of client-side assigning a URL + description
   * based on the first artifact registered.
   *
   * I suspect there's a bug somewhere here since the first artifact tends to be named "imported-files"
   *
   * Example: <boltArtifact id="imported-files" title="Interactive Tic Tac Toe Game"
   */
  if (typeof message.content !== 'string') {
    return null;
  }

  const match = message.content.match(/<boltArtifact id="([^"]+)" title="([^"]+)"/);

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

export async function createNewChatFromMessages(
  ctx: MutationCtx,
  args: {
    id: string;
    sessionId: Id<'sessions'>;
    description?: string;
    snapshotId?: Id<'_storage'>;
    projectInitParams?: {
      teamSlug: string;
      auth0AccessToken: string;
    };
  },
): Promise<Id<'chats'>> {
  const { id, sessionId, description, snapshotId, projectInitParams } = args;
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
    description,
    timestamp: new Date().toISOString(),
    snapshotId,
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
