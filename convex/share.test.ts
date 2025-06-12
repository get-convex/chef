import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import {
  createChat,
  setupTest,
  testProjectInitParams,
  type TestConvex,
  storeChat,
  verifyStoredContent,
} from "./test.setup";
import type { SerializedMessage } from "./messages";
import { describe } from "node:test";

async function initializeChat(t: TestConvex, initialMessage?: SerializedMessage) {
  const { sessionId, chatId } = await createChat(t);
  const firstMessage: SerializedMessage = {
    id: "1",
    role: "user",
    parts: [{ text: "Hello, world!", type: "text" }],
    createdAt: Date.now(),
  };
  await storeChat(t, chatId, sessionId, {
    messages: [initialMessage ?? firstMessage],
    snapshot: new Blob(["Hello, world!"]),
  });
  return { sessionId, chatId };
}

describe("share", () => {
  let t: TestConvex;
  beforeEach(() => {
    vi.useFakeTimers();
    t = setupTest();
  });

  afterEach(async () => {
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    vi.useRealTimers();
  });

  test("sharing a chat fails if there is no snapshot", async () => {
    const t = setupTest();
    const { sessionId } = await createChat(t);
    await expect(t.mutation(api.share.create, { sessionId, id: "test" })).rejects.toThrow("Chat history not found");
  });

  test("sharing a chat works if there is a snapshot + message", async () => {
    const { sessionId, chatId } = await initializeChat(t);
    const code = await t.mutation(api.share.create, { sessionId, id: chatId });
    expect(code).toBeDefined();
  });

  test("getShareDescription works", async () => {
    const { sessionId, chatId } = await initializeChat(t);
    await t.mutation(api.messages.setUrlId, {
      sessionId,
      chatId,
      urlHint: "test",
      description: "This is a test chat",
    });
    const { code } = await t.mutation(api.share.create, { sessionId, id: "test" });
    expect(code).toBeDefined();
    const { description } = await t.query(api.share.getShareDescription, { code });
    expect(description).toBe("This is a test chat");
  });

  test("cloning a chat forks history", async () => {
    const firstMessage: SerializedMessage = {
      id: "1",
      role: "user",
      parts: [{ text: "Hello, world!", type: "text" }],
      createdAt: Date.now(),
    };
    const { sessionId, chatId } = await initializeChat(t, firstMessage);
    const { code } = await t.mutation(api.share.create, { sessionId, id: chatId });
    expect(code).toBeDefined();
    const { id: clonedChatId } = await t.mutation(api.share.clone, {
      sessionId,
      shareCode: code,
      projectInitParams: testProjectInitParams,
    });
    expect(clonedChatId).toBeDefined();
    const response = await t.fetch("/initial_messages", {
      method: "POST",
      body: JSON.stringify({
        chatId: clonedChatId,
        sessionId,
      }),
    });
    const secondMessage: SerializedMessage = {
      id: "2",
      role: "assistant",
      parts: [{ text: "Hi!", type: "text" }],
      createdAt: Date.now(),
    };
    await storeChat(t, clonedChatId, sessionId, {
      messages: [firstMessage, secondMessage],
    });
    // Note: Usually we'd need to decompress the messages, but we skip compression
    // in tests
    const messages = await response.json();
    expect(messages.length).toBe(1);
    expect(messages[0]).toMatchObject(firstMessage);
  });

  test("cloning a chat preserves the snapshotId in both the chat and storage state", async () => {
    const { sessionId, chatId } = await initializeChat(t);

    // Create a share
    const { code } = await t.mutation(api.share.create, { sessionId, id: chatId });
    expect(code).toBeDefined();

    // Get the original share to get its snapshotId
    const originalShare = await t.run(async (ctx) => {
      return ctx.db
        .query("shares")
        .withIndex("byCode", (q) => q.eq("code", code))
        .first();
    });
    expect(originalShare).not.toBeNull();
    if (!originalShare || !originalShare.snapshotId) {
      throw new Error("Share not found or missing snapshotId");
    }

    // Clone the chat
    const { id: clonedChatId } = await t.mutation(api.share.clone, {
      sessionId,
      shareCode: code,
      projectInitParams: testProjectInitParams,
    });
    expect(clonedChatId).toBeDefined();

    // Get the cloned chat from the database
    const clonedChat = await t.run(async (ctx) => {
      return ctx.db
        .query("chats")
        .withIndex("byInitialId", (q) => q.eq("initialId", clonedChatId))
        .first();
    });
    expect(clonedChat).not.toBeNull();
    if (!clonedChat) {
      throw new Error("Cloned chat not found");
    }

    // Verify the snapshotId was preserved in the chat
    expect(clonedChat.snapshotId).toBe(originalShare.snapshotId);

    // Get the storage state for the cloned chat
    const clonedStorageState = await t.run(async (ctx) => {
      return ctx.db
        .query("chatMessagesStorageState")
        .filter((q) => q.eq(q.field("chatId"), clonedChat._id))
        .first();
    });
    expect(clonedStorageState).not.toBeNull();
    if (!clonedStorageState) {
      throw new Error("Cloned storage state not found");
    }

    // Verify the snapshotId was preserved in the storage state
    expect(clonedStorageState.snapshotId).toBe(originalShare.snapshotId);

    // Verify the actual content of the snapshot is accessible
    await verifyStoredContent(t, clonedChat.snapshotId, "Hello, world!");
  });

  // TODO: Test that cloning messages does not leak a more recent snapshot or later messages

  test("sharing a chat uses the snapshot in the chatMessagesStorageState table", async () => {
    const { sessionId, chatId } = await createChat(t);

    // First, create an old snapshot and store it in the chats table
    const oldSnapshotContent = "old snapshot content";
    const oldSnapshotId = await t.run(async (ctx) => {
      return ctx.storage.store(new Blob([oldSnapshotContent]));
    });
    await t.mutation(internal.snapshot.saveSnapshot, {
      sessionId,
      chatId,
      storageId: oldSnapshotId,
    });
    await verifyStoredContent(t, oldSnapshotId, oldSnapshotContent);

    // Store a message with a new snapshot using storeChat
    const message: SerializedMessage = {
      id: "1",
      role: "user",
      parts: [{ text: "Hello, world!", type: "text" }],
      createdAt: Date.now(),
    };
    const newSnapshotContent = "new snapshot content";
    await storeChat(t, chatId, sessionId, {
      messages: [message],
      snapshot: new Blob([newSnapshotContent]),
    });

    // Get the storage info to verify the new snapshot was stored
    const storageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
    });
    expect(storageInfo).not.toBeNull();
    expect(storageInfo?.snapshotId).not.toBeNull();
    expect(storageInfo?.snapshotId).not.toBe(oldSnapshotId);

    // Create a share and verify it uses the new snapshot
    const { code } = await t.mutation(api.share.create, { sessionId, id: chatId });
    expect(code).toBeDefined();

    // Get the share and verify it has the new snapshot ID
    const share = await t.run(async (ctx) => {
      return ctx.db
        .query("shares")
        .withIndex("byCode", (q) => q.eq("code", code))
        .first();
    });
    expect(share).not.toBeNull();
    if (!share) {
      throw new Error("Share not found");
    }
    if (!storageInfo?.snapshotId) {
      throw new Error("No snapshot ID");
    }

    // Verify the share uses the new snapshot from chatMessagesStorageState
    expect(share.snapshotId).toBe(storageInfo.snapshotId);
    expect(share.snapshotId).not.toBe(oldSnapshotId);

    if (!share.snapshotId) {
      throw new Error("No snapshot ID");
    }
    await verifyStoredContent(t, share.snapshotId, newSnapshotContent);
  });

  test("sharing falls back to chat.snapshotId when storageState has no snapshot", async () => {
    const { sessionId, chatId } = await createChat(t);

    // Create a snapshot and store it in the chats table
    const snapshotContent = "snapshot from chats table";
    const snapshotId = await t.run(async (ctx) => {
      return ctx.storage.store(new Blob([snapshotContent]));
    });
    await t.mutation(internal.snapshot.saveSnapshot, {
      sessionId,
      chatId,
      storageId: snapshotId,
    });

    // Store a message without a snapshot to create storageState
    const message: SerializedMessage = {
      id: "1",
      role: "user",
      parts: [{ text: "Hello, world!", type: "text" }],
      createdAt: Date.now(),
    };
    await storeChat(t, chatId, sessionId, {
      messages: [message],
    });

    // Verify we have storageState but no snapshot in it
    const storageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
    });
    expect(storageInfo).not.toBeNull();
    expect(storageInfo?.storageId).not.toBeNull();
    expect(storageInfo?.snapshotId).toBeUndefined();

    // Create a share and verify it uses the snapshot from chats table
    const { code } = await t.mutation(api.share.create, { sessionId, id: chatId });
    expect(code).toBeDefined();

    // Get the share and verify it has the snapshot ID from chats table
    const share = await t.run(async (ctx) => {
      return ctx.db
        .query("shares")
        .withIndex("byCode", (q) => q.eq("code", code))
        .first();
    });
    expect(share).not.toBeNull();
    if (!share) {
      throw new Error("Share not found");
    }
    if (!share.snapshotId) {
      throw new Error("No snapshot ID in share");
    }

    // Verify the share uses the snapshot from chats table
    expect(share.snapshotId).toBe(snapshotId);

    // Verify the actual content of the snapshot
    await verifyStoredContent(t, share.snapshotId, snapshotContent);
  });
});
