import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { UIMessage as AIMessage } from "ai";
import { ConvexError, v } from "convex/values";
import type { Infer } from "convex/values";
import { isValidSession } from "./sessions";
import type { Doc, Id } from "./_generated/dataModel";
import { ensureEnvVar, startProvisionConvexProjectHelper } from "./convexProjects";
import { internal } from "./_generated/api";
import { assertIsConvexAdmin } from "./admin";

export type SerializedMessage = Omit<AIMessage, "createdAt" | "content"> & {
  createdAt: number | undefined;
  content?: string;
};

export const CHAT_NOT_FOUND_ERROR = new ConvexError({ code: "NotFound", message: "Chat not found" });

export const initializeChat = mutation({
  args: {
    sessionId: v.id("sessions"),
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

export const setUrlId = mutation({
  args: {
    sessionId: v.id("sessions"),
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
      throw CHAT_NOT_FOUND_ERROR;
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
    sessionId: v.id("sessions"),
    id: v.string(),
    description: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { id, description } = args;
    const existing = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id, sessionId: args.sessionId });

    if (!existing) {
      throw CHAT_NOT_FOUND_ERROR;
    }

    await ctx.db.patch(existing._id, {
      description,
    });
  },
});

export async function getChat(ctx: QueryCtx, id: string, sessionId: Id<"sessions">) {
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
    subchatIndex: chat.lastSubchatIndex,
  };
}

export const get = query({
  args: {
    id: v.string(),
    sessionId: v.id("sessions"),
  },
  returns: v.union(
    v.null(),
    v.object({
      initialId: v.string(),
      urlId: v.optional(v.string()),
      description: v.optional(v.string()),
      timestamp: v.string(),
      snapshotId: v.optional(v.id("_storage")),
      subchatIndex: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const { id, sessionId } = args;
    return await getChat(ctx, id, sessionId);
  },
});

export async function getLatestChatMessageStorageState(
  ctx: QueryCtx,
  chat: { _id: Id<"chats">; subchatIndex: number; lastMessageRank?: number },
) {
  const lastMessageRank = chat.lastMessageRank;
  if (lastMessageRank === undefined) {
    return await ctx.db
      .query("chatMessagesStorageState")
      .withIndex("byChatId", (q) => q.eq("chatId", chat._id).eq("subchatIndex", chat.subchatIndex))
      .order("desc")
      .first();
  }
  return await ctx.db
    .query("chatMessagesStorageState")
    .withIndex("byChatId", (q) =>
      q.eq("chatId", chat._id).eq("subchatIndex", chat.subchatIndex).lte("lastMessageRank", lastMessageRank),
    )
    .order("desc")
    .first();
}

export const storageInfo = v.object({
  storageId: v.union(v.id("_storage"), v.null()),
  lastMessageRank: v.number(),
  partIndex: v.number(),
  snapshotId: v.optional(v.id("_storage")),
  subchatIndex: v.optional(v.number()),
});

export type StorageInfo = Infer<typeof storageInfo>;

export const getInitialMessagesStorageInfo = internalQuery({
  args: {
    sessionId: v.id("sessions"),
    chatId: v.string(),
    subchatIndex: v.number(),
  },
  returns: v.union(v.null(), storageInfo),
  handler: async (ctx, args): Promise<StorageInfo | null> => {
    const { chatId, sessionId } = args;
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    if (!chat) {
      return null;
    }
    const chatWithSubchatIndex = { ...chat, subchatIndex: args.subchatIndex };
    const doc = await getLatestChatMessageStorageState(ctx, chatWithSubchatIndex);
    if (!doc) {
      return null;
    }
    return {
      storageId: doc.storageId,
      lastMessageRank: doc.lastMessageRank,
      partIndex: doc.partIndex,
      snapshotId: doc.snapshotId,
      subchatIndex: doc.subchatIndex,
    };
  },
});

// Used for debugging, and thus does not do access control checks
export const getMessagesByChatInitialIdBypassingAccessControl = internalQuery({
  args: {
    id: v.string(),
    ensureAdmin: v.optional(v.boolean()),
    subchatIndex: v.number(),
  },
  returns: v.union(v.id("_storage"), v.null()),
  handler: async (ctx, args) => {
    if (args.ensureAdmin) {
      await assertIsConvexAdmin(ctx);
    }
    const chat = await ctx.db
      .query("chats")
      .withIndex("byInitialId", (q) => q.eq("initialId", args.id))
      .unique();
    if (!chat) {
      throw CHAT_NOT_FOUND_ERROR;
    }
    const chatWithSubchatIndex = { ...chat, subchatIndex: args.subchatIndex };
    const storageInfo = await getLatestChatMessageStorageState(ctx, chatWithSubchatIndex);
    if (storageInfo === null) {
      throw new ConvexError({ code: "NotFound", message: "Chat messages storage state not found" });
    }
    return storageInfo.storageId;
  },
});

export const updateStorageState = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    chatId: v.string(),
    storageId: v.union(v.id("_storage"), v.null()),
    lastMessageRank: v.number(),
    subchatIndex: v.number(),
    partIndex: v.number(),
    snapshotId: v.optional(v.union(v.id("_storage"), v.null())),
  },
  returns: v.union(v.id("chatMessagesStorageState"), v.null()),
  handler: async (ctx, args): Promise<Id<"chatMessagesStorageState"> | null> => {
    const { chatId, storageId, lastMessageRank, partIndex, snapshotId, sessionId } = args;
    const messageHistoryStorageId = storageId;
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    if (!chat) {
      throw CHAT_NOT_FOUND_ERROR;
    }
    await deletePreviousStorageStates(ctx, { chat, subchatIndex: args.subchatIndex });
    const previous = await getLatestChatMessageStorageState(ctx, {
      _id: chat._id,
      subchatIndex: args.subchatIndex,
    });
    if (!previous) {
      throw new Error("Chat messages storage state not found");
    }
    if (previous.lastMessageRank > lastMessageRank) {
      console.warn(
        `Stale update -- stored messages up to ${previous.lastMessageRank} but received update up to ${lastMessageRank}`,
      );
      return null;
    }
    if (previous.lastMessageRank === lastMessageRank && previous.partIndex > partIndex) {
      console.warn(
        `Stale update -- stored parts in message ${previous.lastMessageRank} up to part ${previous.partIndex} but received update up to part ${partIndex}`,
      );
      return null;
    }

    if (previous.lastMessageRank === lastMessageRank && previous.partIndex === partIndex) {
      if (messageHistoryStorageId !== null && snapshotId === null) {
        // Should this error?
        console.warn(
          `Received duplicate update for message history, message ${lastMessageRank} part ${partIndex}, ignoring`,
        );
        return null;
      }
      if (snapshotId === null) {
        throw new Error("Received null snapshotId for message that is already saved and has no storageId");
      }
      await ctx.db.patch(previous._id, {
        snapshotId,
      });
      return null;
    }

    if (previous.storageId !== null && storageId === null) {
      throw new Error("Received null storageId for a chat with messages");
    }

    if (previous.lastMessageRank === lastMessageRank) {
      if (previous.partIndex >= partIndex) {
        throw new Error("Tried to update to a part that is already stored. Should have already returned.");
      }
      // This is a part update, so we can patch instead of inserting a new document, cleaning up the old stored state.
      // We do not support rewinding to parts.
      if (previous.storageId !== null) {
        const unusedByShares = await storageIdUnusedByShares(ctx, previous.storageId);
        if (unusedByShares) {
          await ctx.storage.delete(previous.storageId);
        }
      }
      if (previous.snapshotId && previous.snapshotId !== snapshotId && snapshotId) {
        const unusedByChatsAndShares = await snapshotIdUnusedByChatsAndShares(ctx, previous.snapshotId);
        const storageStatesWithSameSnapshotId = await ctx.db
          .query("chatMessagesStorageState")
          .withIndex("bySnapshotId", (q) => q.eq("snapshotId", previous.snapshotId))
          .collect();
        // Only the document we're updating references this snapshotId, so it's safe to delete.
        if (
          unusedByChatsAndShares &&
          storageStatesWithSameSnapshotId.length === 1 &&
          storageStatesWithSameSnapshotId[0]._id === previous._id
        ) {
          await ctx.storage.delete(previous.snapshotId);
        }
      }
      await ctx.db.patch(previous._id, {
        storageId,
        partIndex,
        snapshotId: snapshotId ?? previous.snapshotId,
      });
      return null;
    }

    const id = await ctx.db.insert("chatMessagesStorageState", {
      chatId: chat._id,
      storageId,
      lastMessageRank,
      subchatIndex: args.subchatIndex,
      partIndex,
      // Should we be using null here to distinguish between not having a snapshot and records written before we also recorded snapshots here?
      snapshotId: snapshotId ?? previous.snapshotId,
      description: previous.description,
    });
    if (previous.description === undefined) {
      return id;
    }
    return null;
  },
});

export async function storageIdUnusedByShares(ctx: MutationCtx, chatStorageId: Id<"_storage">) {
  const shareRef = await ctx.db
    .query("shares")
    .withIndex("byChatHistoryId", (q) => q.eq("chatHistoryId", chatStorageId))
    .first();
  return shareRef === null;
}

async function deleteChatStorageIdIfUnused(ctx: MutationCtx, chatStorageId: Id<"_storage">) {
  const chatHistoryRef = await ctx.db
    .query("chatMessagesStorageState")
    .withIndex("byStorageId", (q) => q.eq("storageId", chatStorageId))
    .first();
  if (chatHistoryRef) {
    // I don't think it's possible in the current data model to have a duplicate storageId
    // here because there should not be duplicate rows for the same chatId, lastMessageRank,
    //  and partIndex. Newer snapshots should be patched.
    console.warn("Unexpectedly found chatHistoryRef for storageId", chatStorageId);
  }
  const unusedByShares = await storageIdUnusedByShares(ctx, chatStorageId);
  if (unusedByShares && chatHistoryRef === null) {
    await ctx.storage.delete(chatStorageId);
  }
}

export async function snapshotIdUnusedByChatsAndShares(ctx: MutationCtx, snapshotId: Id<"_storage">) {
  const chatRef = await ctx.db
    .query("chats")
    .withIndex("bySnapshotId", (q) => q.eq("snapshotId", snapshotId))
    .first();
  const shareRef = await ctx.db
    .query("shares")
    .withIndex("bySnapshotId", (q) => q.eq("snapshotId", snapshotId))
    .first();
  return chatRef === null && shareRef === null;
}

async function deleteSnapshotIdIfUnused(ctx: MutationCtx, snapshotId: Id<"_storage">) {
  const chatHistoryRef = await ctx.db
    .query("chatMessagesStorageState")
    .withIndex("bySnapshotId", (q) => q.eq("snapshotId", snapshotId))
    .first();
  const unusedByChatsAndShares = await snapshotIdUnusedByChatsAndShares(ctx, snapshotId);
  if (unusedByChatsAndShares && chatHistoryRef === null) {
    await ctx.storage.delete(snapshotId);
  }
}

export async function deleteStorageState(ctx: MutationCtx, storageState: Doc<"chatMessagesStorageState">) {
  await ctx.db.delete(storageState._id);
  const chatStorageId = storageState.storageId;
  if (chatStorageId) {
    await deleteChatStorageIdIfUnused(ctx, chatStorageId);
  }
  const snapshotId = storageState.snapshotId;
  if (snapshotId) {
    await deleteSnapshotIdIfUnused(ctx, snapshotId);
  }
}

async function deletePreviousStorageStates(
  ctx: MutationCtx,
  args: {
    chat: Doc<"chats">;
    subchatIndex: number;
  },
) {
  const { chat } = args;
  const chatLastMessageRank = chat.lastMessageRank;
  if (chatLastMessageRank !== undefined) {
    // Remove the storage state records for future messages on a different branch
    let storageStatesToDelete = await ctx.db
      .query("chatMessagesStorageState")
      .withIndex("byChatId", (q) =>
        q.eq("chatId", chat._id).eq("subchatIndex", args.subchatIndex).gt("lastMessageRank", chatLastMessageRank),
      )
      .collect();

    // If we rewinded to a previous subchat, we delete all the storage states for the future subchats
    const futureSubchatStorageStates = await ctx.db
      .query("chatMessagesStorageState")
      .withIndex("byChatId", (q) => q.eq("chatId", chat._id).gt("subchatIndex", args.subchatIndex))
      .collect();
    storageStatesToDelete.push(...futureSubchatStorageStates);

    for (const storageState of storageStatesToDelete) {
      await deleteStorageState(ctx, storageState);
    }
    ctx.db.patch(chat._id, { lastMessageRank: undefined });
  }
}

export const earliestRewindableMessageRank = query({
  args: {
    sessionId: v.id("sessions"),
    chatId: v.string(),
    subchatIndex: v.optional(v.number()),
  },
  // Return null if there is no snapshot stored in chatMessagesStorageState (possible for older chats)
  returns: v.union(v.null(), v.number()),
  handler: async (ctx, args): Promise<number | null> => {
    const { chatId, sessionId } = args;
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    if (!chat) {
      throw CHAT_NOT_FOUND_ERROR;
    }
    // We use the latest subchatIndex for the chat because we are only guaranteed to have
    // storage states for individual messages in the latest subchat
    const subchatIndex = args.subchatIndex ?? chat.lastSubchatIndex;
    const chatWithSubchatIndex = { ...chat, subchatIndex };
    const latestState = await getLatestChatMessageStorageState(ctx, chatWithSubchatIndex);
    if (!latestState) {
      // This is possible for older chats that were created before we started storing storage states
      return null;
    }
    const docs = await ctx.db
      .query("chatMessagesStorageState")
      .withIndex("byChatId", (q) =>
        q.eq("chatId", chat._id).eq("subchatIndex", subchatIndex).lte("lastMessageRank", latestState.lastMessageRank),
      )
      .order("asc")
      .take(10);

    const docWithSnapshot = docs.find((doc) => doc.snapshotId !== undefined && doc.snapshotId !== null);

    if (!docWithSnapshot) {
      return null;
    }
    return docWithSnapshot.lastMessageRank;
  },
});

export const rewindChat = mutation({
  args: {
    sessionId: v.id("sessions"),
    chatId: v.string(),
    subchatIndex: v.optional(v.number()),
    lastMessageRank: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const { chatId, sessionId, lastMessageRank } = args;
    const subchatIndex = args.subchatIndex ?? 0;
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    if (!chat) {
      throw CHAT_NOT_FOUND_ERROR;
    }
    if (lastMessageRank && args.subchatIndex !== chat.lastSubchatIndex) {
      throw new ConvexError({
        code: "InvalidState",
        message: "Cannot rewind to a specific message in a subchat that is not the latest subchat",
      });
    }
    if (lastMessageRank === undefined && args.subchatIndex === chat.lastSubchatIndex) {
      throw new ConvexError({
        code: "InvalidState",
        message: "Cannot rewind to a specific message in the latest subchat without a lastMessageRank",
      });
    }
    const latestStorageState = await getLatestChatMessageStorageState(ctx, {
      _id: chat._id,
      subchatIndex,
      lastMessageRank,
    });
    if (latestStorageState === null) {
      throw new Error(`Storage state not found for lastMessageRank ${lastMessageRank} in chat ${chatId}`);
    }
    if (latestStorageState.storageId === null) {
      throw new ConvexError({ code: "NoMessagesSaved", message: "Cannot rewind to a chat with no messages saved" });
    }

    if (chat.lastMessageRank !== undefined && lastMessageRank !== undefined && chat.lastMessageRank < lastMessageRank) {
      throw new ConvexError({
        code: "RewindToFuture",
        message: "Cannot rewind to a future message",
        data: {
          lastMessageRank,
          currentLastMessageRank: chat.lastMessageRank,
        },
      });
    }
    await ctx.db.patch(chat._id, {
      lastSubchatIndex: subchatIndex,
      lastMessageRank: latestStorageState.lastMessageRank,
    });
    await deletePreviousStorageStates(ctx, {
      chat: { ...chat, lastMessageRank: latestStorageState.lastMessageRank, lastSubchatIndex: subchatIndex },
      subchatIndex,
    });
  },
});

export const maybeCleanupStaleChatHistory = internalMutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args): Promise<void> => {
    const chatRef = await ctx.db
      .query("chatMessagesStorageState")
      .withIndex("byStorageId", (q) => q.eq("storageId", args.storageId))
      .first();
    if (chatRef !== null) {
      return;
    }

    const shareRef = await ctx.db
      .query("shares")
      .withIndex("byChatHistoryId", (q) => q.eq("chatHistoryId", args.storageId))
      .first();
    if (shareRef !== null) {
      return;
    }

    await ctx.storage.delete(args.storageId);
  },
});

export const getAll = query({
  args: {
    sessionId: v.id("sessions"),
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
      .query("chats")
      .withIndex("byCreatorAndUrlId", (q) => q.eq("creatorId", sessionId))
      .filter((q) => q.neq(q.field("isDeleted"), true))
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
    sessionId: v.id("sessions"),
    id: v.string(),
    teamSlug: v.optional(v.string()),
    projectSlug: v.optional(v.string()),
    shouldDeleteConvexProject: v.boolean(),
    accessToken: v.string(),
  },
  handler: async (ctx, args) => {
    const { accessToken, id, sessionId, teamSlug, projectSlug, shouldDeleteConvexProject } = args;
    let projectDeletionResult: { kind: "success" } | { kind: "error"; error: string } = { kind: "success" };
    if (shouldDeleteConvexProject) {
      projectDeletionResult = await tryDeleteProject({ teamSlug, projectSlug, accessToken });
    }

    await ctx.runMutation(internal.messages.removeChat, {
      id,
      sessionId,
    });

    if (projectDeletionResult.kind === "error") {
      return {
        kind: "error",
        error: `Deleted chat, but failed to delete linked Convex project:\n${projectDeletionResult.error}`,
      };
    }
    return { kind: "success" };
  },
});

async function tryDeleteProject(args: {
  teamSlug: string | undefined;
  projectSlug: string | undefined;
  accessToken: string;
}): Promise<{ kind: "success" } | { kind: "error"; error: string }> {
  const { teamSlug, projectSlug, accessToken } = args;
  if (teamSlug === undefined || projectSlug === undefined) {
    return { kind: "error", error: "Team slug and project slug are required to delete a Convex project" };
  }

  const bigBrainHost = ensureEnvVar("BIG_BRAIN_HOST");

  const projectsResponse = await fetch(`${bigBrainHost}/api/teams/${teamSlug}/projects`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!projectsResponse.ok) {
    const text = await projectsResponse.text();
    try {
      const error = JSON.parse(text);
      if (error.code === "TeamNotFound") {
        return { kind: "error", error: `Team not found: ${teamSlug}` };
      }
      return { kind: "error", error: `Failed to fetch team projects: ${projectsResponse.statusText} ${text}` };
    } catch (_e) {
      return { kind: "error", error: `Failed to fetch team projects: ${projectsResponse.statusText} ${text}` };
    }
  }

  const projects = await projectsResponse.json();
  const project = projects.find((p: any) => p.slug === projectSlug);

  if (project) {
    const response = await fetch(`${bigBrainHost}/api/dashboard/delete_project/${project.id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return { kind: "error", error: `Failed to delete project: ${response.statusText} ${text}` };
    }
  }

  return { kind: "success" };
}

export const removeChat = internalMutation({
  args: {
    id: v.string(),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const existing = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: args.id, sessionId: args.sessionId });

    if (!existing) {
      return;
    }

    const convexProject = existing.convexProject;
    if (convexProject !== undefined && convexProject.kind === "connected") {
      const credentials = await ctx.db
        .query("convexProjectCredentials")
        .withIndex("bySlugs", (q) =>
          q.eq("teamSlug", convexProject.teamSlug).eq("projectSlug", convexProject.projectSlug),
        )
        .unique();
      if (credentials !== null) {
        await ctx.db.delete(credentials._id);
      }
    }
    await ctx.db.patch(existing._id, {
      isDeleted: true,
    });
  },
});

async function _allocateUrlId(ctx: QueryCtx, { urlHint, sessionId }: { urlHint: string; sessionId: Id<"sessions"> }) {
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
    sessionId: Id<"sessions">;
    projectInitParams?: {
      teamSlug: string;
      auth0AccessToken: string;
    };
  },
): Promise<Id<"chats">> {
  const { id, sessionId, projectInitParams } = args;
  const existing = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id, sessionId });

  if (existing) {
    throw new ConvexError({ code: "InvalidState", message: "Chat already exists" });
  }

  const session = await ctx.db.get(sessionId);
  if (!session) {
    throw new Error(`Invalid state -- session should exist: ${sessionId}`);
  }

  const chatId = await ctx.db.insert("chats", {
    creatorId: sessionId,
    initialId: id,
    timestamp: new Date().toISOString(),
    isDeleted: false,
    lastSubchatIndex: 0,
  });
  await ctx.db.insert("chatMessagesStorageState", {
    chatId,
    storageId: null,
    lastMessageRank: -1,
    subchatIndex: 0,
    partIndex: -1,
  });

  await startProvisionConvexProjectHelper(ctx, {
    sessionId,
    chatId: id,
    projectInitParams,
  });

  return chatId;
}

function getChatByInitialId(ctx: QueryCtx, { id, sessionId }: { id: string; sessionId: Id<"sessions"> }) {
  return ctx.db
    .query("chats")
    .withIndex("byCreatorAndId", (q) => q.eq("creatorId", sessionId).eq("initialId", id).lt("isDeleted", true))
    .unique();
}

function getChatByUrlId(ctx: QueryCtx, { id, sessionId }: { id: string; sessionId: Id<"sessions"> }) {
  return ctx.db
    .query("chats")
    .withIndex("byCreatorAndUrlId", (q) => q.eq("creatorId", sessionId).eq("urlId", id).lt("isDeleted", true))
    .unique();
}

export async function getChatByIdOrUrlIdEnsuringAccess(
  ctx: QueryCtx,
  { id, sessionId }: { id: string; sessionId: Id<"sessions"> },
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

function getIdentifier(chat: Doc<"chats">): string {
  return chat.urlId ?? chat.initialId!;
}

// TODO: Figure out how we want to handle subchats here
export const eraseMessageHistory = internalMutation({
  args: {
    shareCode: v.string(),
    dryRun: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { shareCode, dryRun } = args;
    const share = await ctx.db
      .query("socialShares")
      .withIndex("byCode", (q) => q.eq("code", shareCode))
      .unique();
    if (share === null) {
      throw new ConvexError({ code: "NotFound", message: "Share not found" });
    }
    console.log("ChatId for share is", share.chatId);
    const chat = await ctx.db.get(share.chatId);
    if (chat === null) {
      throw CHAT_NOT_FOUND_ERROR;
    }
    // Get the most recent filesystem snapshot
    const mostRecentStorageState = await ctx.db
      .query("chatMessagesStorageState")
      .withIndex("byChatId", (q) => q.eq("chatId", share.chatId))
      .order("desc")
      .first();
    if (mostRecentStorageState === null) {
      throw new ConvexError({ code: "NotFound", message: "No storage state found for chat" });
    }
    console.log("Most recent storage state is", mostRecentStorageState);
    const mostRecentFilesystemSnapshot = mostRecentStorageState.snapshotId;
    if (mostRecentFilesystemSnapshot === undefined) {
      throw new ConvexError({ code: "NotFound", message: "No filesystem snapshot found for chat" });
    }
    const earliestMessages = await ctx.db
      .query("chatMessagesStorageState")
      .withIndex("byChatId", (q) => q.eq("chatId", share.chatId))
      .order("asc")
      .take(100);
    let earliestMessageWithSnapshot: Doc<"chatMessagesStorageState"> | null = null;
    for (const storageState of earliestMessages) {
      if (storageState.snapshotId !== undefined) {
        earliestMessageWithSnapshot = storageState;
        break;
      }
    }
    if (earliestMessageWithSnapshot === null) {
      throw new ConvexError({
        code: "NotFound",
        message: "No message with snapshot found for chat after looking at the first 100 message states",
      });
    }

    // Get the latest part with the same lastMessageRank
    const latestEarlyStorageState = await ctx.db
      .query("chatMessagesStorageState")
      .withIndex("byChatId", (q) =>
        q
          .eq("chatId", share.chatId)
          .eq("subchatIndex", chat.lastSubchatIndex)
          .eq("lastMessageRank", earliestMessageWithSnapshot.lastMessageRank),
      )
      .order("desc")
      .first();
    if (latestEarlyStorageState === null) {
      throw new ConvexError({
        code: "NotFound",
        message: `No storage state found with lastMessageRank ${earliestMessageWithSnapshot.lastMessageRank}`,
      });
    }

    // Replace the latestEarlyStorageState's filesystem snapshot with the most recent filesystem snapshot
    console.log(
      "Replacing filesystem snapshot for chat from",
      latestEarlyStorageState.snapshotId,
      "to",
      mostRecentFilesystemSnapshot,
    );
    if (!dryRun) {
      await ctx.db.patch(latestEarlyStorageState._id, { snapshotId: mostRecentFilesystemSnapshot });
    }

    // Rewind the chat to look at the lastMessageRank of the earliestMessageWithSnapshot
    console.log("Rewinding chat to lastMessageRank", earliestMessageWithSnapshot.lastMessageRank);
    if (!dryRun) {
      await ctx.db.patch(share.chatId, {
        lastMessageRank: earliestMessageWithSnapshot.lastMessageRank,
      });
    }

    if (dryRun) {
      console.log("Dry run, did not update chat or filesystem snapshot");
    }
  },
});
