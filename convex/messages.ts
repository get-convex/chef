import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Message as AIMessage } from "ai";
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
      throw new ConvexError({ code: "NotFound", message: "Chat not found" });
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
      throw new ConvexError({ code: "NotFound", message: "Chat not found" });
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
    }),
  ),
  handler: async (ctx, args) => {
    const { id, sessionId } = args;
    return await getChat(ctx, id, sessionId);
  },
});

export async function getLatestChatMessageStorageState(
  ctx: QueryCtx,
  chat: { _id: Id<"chats">; lastMessageRank?: number },
) {
  const lastMessageRank = chat.lastMessageRank;
  if (lastMessageRank === undefined) {
    return await ctx.db
      .query("chatMessagesStorageState")
      .withIndex("byChatId", (q) => q.eq("chatId", chat._id))
      .order("desc")
      .first();
  }
  return await ctx.db
    .query("chatMessagesStorageState")
    .withIndex("byChatId", (q) => q.eq("chatId", chat._id).lte("lastMessageRank", lastMessageRank))
    .order("desc")
    .first();
}

export const storageInfo = v.object({
  storageId: v.union(v.id("_storage"), v.null()),
  lastMessageRank: v.number(),
  partIndex: v.number(),
  snapshotId: v.optional(v.id("_storage")),
});

export type StorageInfo = Infer<typeof storageInfo>;

export const getInitialMessagesStorageInfo = internalQuery({
  args: {
    sessionId: v.id("sessions"),
    chatId: v.string(),
  },
  returns: v.union(v.null(), storageInfo),
  handler: async (ctx, args): Promise<StorageInfo | null> => {
    const { chatId, sessionId } = args;
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    if (!chat) {
      return null;
    }
    const doc = await getLatestChatMessageStorageState(ctx, chat);
    if (!doc) {
      return null;
    }
    return {
      storageId: doc.storageId,
      lastMessageRank: doc.lastMessageRank,
      partIndex: doc.partIndex,
      snapshotId: doc.snapshotId,
    };
  },
});

// Used for debugging, and thus does not do access control checks
export const getMessagesByChatInitialIdBypassingAccessControl = internalQuery({
  args: {
    id: v.string(),
    ensureAdmin: v.optional(v.boolean()),
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
      throw new ConvexError({ code: "NotFound", message: "Chat not found" });
    }
    const storageInfo = await getLatestChatMessageStorageState(ctx, chat);
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
    partIndex: v.number(),
    snapshotId: v.optional(v.union(v.id("_storage"), v.null())),
  },
  handler: async (ctx, args): Promise<void> => {
    const { chatId, storageId, lastMessageRank, partIndex, snapshotId, sessionId } = args;
    const messageHistoryStorageId = storageId;
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    if (!chat) {
      throw new ConvexError({ code: "NotFound", message: "Chat not found" });
    }
    await deletePreviousStorageStates(ctx, { chat });
    const previous = await getLatestChatMessageStorageState(ctx, chat);
    if (!previous) {
      throw new Error("Chat messages storage state not found");
    }
    if (previous.lastMessageRank > lastMessageRank) {
      console.warn(
        `Stale update -- stored messages up to ${previous.lastMessageRank} but received update up to ${lastMessageRank}`,
      );
      return;
    }
    if (previous.lastMessageRank === lastMessageRank && previous.partIndex > partIndex) {
      console.warn(
        `Stale update -- stored parts in message ${previous.lastMessageRank} up to part ${previous.partIndex} but received update up to part ${partIndex}`,
      );
      return;
    }

    if (previous.lastMessageRank === lastMessageRank && previous.partIndex === partIndex) {
      if (messageHistoryStorageId !== null && snapshotId === null) {
        // Should this error?
        console.warn(
          `Received duplicate update for message history, message ${lastMessageRank} part ${partIndex}, ignoring`,
        );
        return;
      }
      if (snapshotId === null) {
        throw new Error("Received null snapshotId for message that is already saved and has no storageId");
      }
      await ctx.db.patch(previous._id, {
        snapshotId,
      });
      return;
    }

    if (previous.storageId !== null && storageId === null) {
      throw new Error("Received null storageId for a chat with messages");
    }

    await ctx.db.insert("chatMessagesStorageState", {
      chatId: chat._id,
      storageId,
      lastMessageRank,
      partIndex,
      // Should we be using null here to distinguish between not having a snapshot and records written before we also recorded snapshots here?
      snapshotId: snapshotId ?? previous.snapshotId,
    });
  },
});

async function deletePreviousStorageStates(
  ctx: MutationCtx,
  args: {
    chat: Doc<"chats">;
  },
) {
  const { chat } = args;
  const chatLastMessageRank = chat.lastMessageRank;
  if (chatLastMessageRank !== undefined) {
    // Remove the storage state records for future messages on a different branch
    const storageStatesToDelete = await ctx.db
      .query("chatMessagesStorageState")
      .withIndex("byChatId", (q) => q.eq("chatId", chat._id).gt("lastMessageRank", chatLastMessageRank))
      .collect();
    for (const storageState of storageStatesToDelete) {
      await ctx.db.delete(storageState._id);
      const chatStorageId = storageState.storageId;
      if (chatStorageId) {
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
        const shareRef = await ctx.db
          .query("shares")
          .withIndex("byChatHistoryId", (q) => q.eq("chatHistoryId", chatStorageId))
          .first();
        if (shareRef === null && chatHistoryRef === null) {
          await ctx.storage.delete(chatStorageId);
        }
      }
      const snapshotId = storageState.snapshotId;
      if (snapshotId) {
        const chatHistoryRef = await ctx.db
          .query("chatMessagesStorageState")
          .withIndex("bySnapshotId", (q) => q.eq("snapshotId", snapshotId))
          .first();
        const shareRef = await ctx.db
          .query("shares")
          .withIndex("bySnapshotId", (q) => q.eq("snapshotId", snapshotId))
          .first();
        if (shareRef === null && chatHistoryRef === null) {
          await ctx.storage.delete(snapshotId);
        }
      }
    }
    ctx.db.patch(chat._id, { lastMessageRank: undefined });
  }
}

export const earliestRewindableMessageRank = query({
  args: {
    sessionId: v.id("sessions"),
    chatId: v.string(),
  },
  // Return null if there is no snapshot stored in chatMessagesStorageState (possible for older chats)
  returns: v.union(v.null(), v.number()),
  handler: async (ctx, args): Promise<number | null> => {
    const { chatId, sessionId } = args;
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    if (!chat) {
      throw new ConvexError({ code: "NotFound", message: "Chat not found" });
    }
    const latestState = await getLatestChatMessageStorageState(ctx, chat);
    if (!latestState) {
      // This is possible for older chats that were created before we started storing storage states
      return null;
    }
    const docs = await ctx.db
      .query("chatMessagesStorageState")
      .withIndex("byChatId", (q) => q.eq("chatId", chat._id).lte("lastMessageRank", latestState.lastMessageRank))
      .order("asc")
      .collect();

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
    lastMessageRank: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const { chatId, sessionId, lastMessageRank } = args;
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    if (!chat) {
      throw new ConvexError({ code: "NotFound", message: "Chat not found" });
    }
    const latestStorageState = await getLatestChatMessageStorageState(ctx, { _id: chat._id, lastMessageRank });
    if (latestStorageState === null) {
      throw new Error(`Storage state not found for lastMessageRank ${lastMessageRank} in chat ${chatId}`);
    }
    if (latestStorageState.storageId === null) {
      throw new ConvexError({ code: "NoMessagesSaved", message: "Cannot rewind to a chat with no messages saved" });
    }

    if (chat.lastMessageRank !== undefined && chat.lastMessageRank < lastMessageRank) {
      throw new ConvexError({
        code: "RewindToFuture",
        message: "Cannot rewind to a future message",
        data: {
          lastMessageRank,
          currentLastMessageRank: chat.lastMessageRank,
        },
      });
    }
    ctx.db.patch(chat._id, { lastMessageRank });
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
  });
  await ctx.db.insert("chatMessagesStorageState", {
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
