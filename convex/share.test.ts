import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import {
  createChat,
  setupTest,
  testProjectInitParams,
  type TestConvex,
  storeChat,
  verifyStoredContent,
  initializeChat,
  createSubchat,
} from "./test.setup";
import type { SerializedMessage } from "./messages";
import { describe } from "node:test";
import { cloneShow } from "./share";

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

  test("sharing a chat works if there is an empty subchat after the first one", async () => {
    const { sessionId, chatId } = await initializeChat(t);

    const subchat0Message: SerializedMessage = {
      id: "subchat0-msg1",
      role: "user",
      parts: [{ text: "Hello from subchat 0!", type: "text" }],
      createdAt: Date.now(),
    };
    await storeChat(t, chatId, sessionId, {
      messages: [subchat0Message],
      snapshot: new Blob(["subchat 0 snapshot"]),
      subchatIndex: 0,
    });

    // Create a second subchat
    await createSubchat(t, chatId, sessionId);

    const code = await t.mutation(api.share.create, { sessionId, id: chatId });
    expect(code).toBeDefined();
  });

  test("sharing a chat works if there is a snapshot + message", async () => {
    const { sessionId, chatId } = await initializeChat(t);

    // Create a second subchat
    await createSubchat(t, chatId, sessionId);

    // Add messages to the second subchat
    const subchat1Message: SerializedMessage = {
      id: "subchat1-msg1",
      role: "user",
      parts: [{ text: "Hello from subchat 1!", type: "text" }],
      createdAt: Date.now(),
    };
    await storeChat(t, chatId, sessionId, {
      messages: [subchat1Message],
      snapshot: new Blob(["subchat 1 snapshot"]),
      subchatIndex: 1,
    });

    const code = await t.mutation(api.share.create, { sessionId, id: chatId });
    expect(code).toBeDefined();
  });

  test("getShareDescription works", async () => {
    const { sessionId, chatId } = await initializeChat(t);

    // Create a second subchat
    await createSubchat(t, chatId, sessionId);

    // Add messages to the second subchat
    const subchat1Message: SerializedMessage = {
      id: "subchat1-msg1",
      role: "user",
      parts: [{ text: "Hello from subchat 1!", type: "text" }],
      createdAt: Date.now(),
    };
    await storeChat(t, chatId, sessionId, {
      messages: [subchat1Message],
      snapshot: new Blob(["subchat 1 snapshot"]),
      subchatIndex: 1,
    });

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

    // Create a second subchat
    await createSubchat(t, chatId, sessionId);

    // Add messages to the second subchat
    const subchat1Message: SerializedMessage = {
      id: "subchat1-msg1",
      role: "user",
      parts: [{ text: "Hello from subchat 1!", type: "text" }],
      createdAt: Date.now(),
    };
    await storeChat(t, chatId, sessionId, {
      messages: [subchat1Message],
      snapshot: new Blob(["subchat 1 snapshot"]),
      subchatIndex: 1,
    });

    const { code } = await t.mutation(api.share.create, { sessionId, id: chatId });
    expect(code).toBeDefined();
    const { id: clonedChatId } = await t.mutation(api.share.clone, {
      sessionId,
      shareCode: code,
      projectInitParams: testProjectInitParams,
    });
    expect(clonedChatId).toBeDefined();

    // Test that subchat 0 messages are preserved
    const subchat0Response = await t.fetch("/initial_messages", {
      method: "POST",
      body: JSON.stringify({
        chatId: clonedChatId,
        sessionId,
        subchatIndex: 0,
      }),
    });
    const subchat0Messages = await subchat0Response.json();
    expect(subchat0Messages.length).toBe(1);
    expect(subchat0Messages[0]).toMatchObject(firstMessage);

    // Test that subchat 1 messages are preserved
    const subchat1Response = await t.fetch("/initial_messages", {
      method: "POST",
      body: JSON.stringify({
        chatId: clonedChatId,
        sessionId,
        subchatIndex: 1,
      }),
    });
    const subchat1Messages = await subchat1Response.json();
    expect(subchat1Messages.length).toBe(1);
    expect(subchat1Messages[0]).toMatchObject(subchat1Message);
  });

  test("cloning a chat preserves the snapshotId in both the chat and storage state", async () => {
    const { sessionId, chatId } = await initializeChat(t);

    // Create a second subchat
    await createSubchat(t, chatId, sessionId);

    // Add messages to the second subchat
    const subchat1Message: SerializedMessage = {
      id: "subchat1-msg1",
      role: "user",
      parts: [{ text: "Hello from subchat 1!", type: "text" }],
      createdAt: Date.now(),
    };
    await storeChat(t, chatId, sessionId, {
      messages: [subchat1Message],
      snapshot: new Blob(["subchat 1 snapshot"]),
      subchatIndex: 1,
    });

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

    // Get the storage states for the cloned chat (should have multiple)
    const clonedStorageStates = await t.run(async (ctx) => {
      return ctx.db
        .query("chatMessagesStorageState")
        .filter((q) => q.eq(q.field("chatId"), clonedChat._id))
        .collect();
    });
    expect(clonedStorageStates.length).toBeGreaterThan(0);

    // Verify storage states for both subchats exist
    const subchat0Storage = clonedStorageStates.find((s) => s.subchatIndex === 0);
    const subchat1Storage = clonedStorageStates.find((s) => s.subchatIndex === 1);

    expect(subchat0Storage).not.toBeNull();
    expect(subchat1Storage).not.toBeNull();

    if (!subchat0Storage || !subchat1Storage) {
      throw new Error("Storage states for subchats not found");
    }

    // Verify the snapshotId was preserved in both storage states
    // The original share should use the snapshotId from the latest subchat
    expect(subchat1Storage.snapshotId).toBe(originalShare.snapshotId);
    expect(subchat0Storage.snapshotId).toBeDefined();

    // Verify the actual content of the snapshot is accessible
    await verifyStoredContent(t, clonedChat.snapshotId, "subchat 1 snapshot");
  });

  test("cloning a chat from a social share preserves the snapshotId in both the chat and storage state", async () => {
    const { sessionId, chatId } = await initializeChat(t);

    // Create a second subchat
    await createSubchat(t, chatId, sessionId);

    // Add messages to the second subchat
    const subchat1Message: SerializedMessage = {
      id: "subchat1-msg1",
      role: "user",
      parts: [{ text: "Hello from subchat 1!", type: "text" }],
      createdAt: Date.now(),
    };
    await storeChat(t, chatId, sessionId, {
      messages: [subchat1Message],
      snapshot: new Blob(["subchat 1 snapshot"]),
      subchatIndex: 1,
    });

    // Create a share
    const code = await t.mutation(api.socialShare.share, {
      sessionId,
      id: chatId,
      shared: "shared",
      allowForkFromLatest: true,
    });

    // Get the original share to get its snapshotId
    const share = await t.query(api.socialShare.getSocialShare, { code });
    expect(share).not.toBeNull();

    // Clone the chat
    const { id: clonedChatId } = await t.run(async (ctx) => {
      return await cloneShow(ctx, {
        showCode: code,
        sessionId,
        projectInitParams: testProjectInitParams,
      });
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
    expect(clonedChat.snapshotId).not.toBeNull();

    // Get the storage states for the cloned chat (should have multiple)
    const clonedStorageStates = await t.run(async (ctx) => {
      return ctx.db
        .query("chatMessagesStorageState")
        .filter((q) => q.eq(q.field("chatId"), clonedChat._id))
        .collect();
    });
    expect(clonedStorageStates.length).toBeGreaterThan(0);

    // Verify storage states for both subchats exist
    const subchat0Storage = clonedStorageStates.find((s) => s.subchatIndex === 0);
    const subchat1Storage = clonedStorageStates.find((s) => s.subchatIndex === 1);

    expect(subchat0Storage).not.toBeNull();
    expect(subchat1Storage).not.toBeNull();

    if (!subchat0Storage || !subchat1Storage) {
      throw new Error("Storage states for subchats not found");
    }

    // Verify the snapshotId was preserved in both storage states
    expect(subchat0Storage.snapshotId).not.toBeNull();
    expect(subchat1Storage.snapshotId).not.toBeNull();
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

    // Create a second subchat with different snapshot
    await createSubchat(t, chatId, sessionId);

    const subchat1Message: SerializedMessage = {
      id: "subchat1-msg1",
      role: "user",
      parts: [{ text: "Hello from subchat 1!", type: "text" }],
      createdAt: Date.now(),
    };
    const subchat1SnapshotContent = "subchat 1 snapshot content";
    await storeChat(t, chatId, sessionId, {
      messages: [subchat1Message],
      snapshot: new Blob([subchat1SnapshotContent]),
      subchatIndex: 1,
    });

    // Get the storage info to verify the new snapshot was stored for subchat 0
    const storageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    expect(storageInfo).not.toBeNull();
    expect(storageInfo?.snapshotId).not.toBeNull();
    expect(storageInfo?.snapshotId).not.toBe(oldSnapshotId);

    // Verify subchat 1 has its own snapshot
    const subchat1StorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 1,
    });
    expect(subchat1StorageInfo).not.toBeNull();
    expect(subchat1StorageInfo?.snapshotId).not.toBeNull();

    // Create a share and verify it uses the snapshot from the latest subchat
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
    if (!subchat1StorageInfo?.snapshotId) {
      throw new Error("No snapshot ID");
    }

    // Verify the share uses the new snapshot from chatMessagesStorageState (latest subchat)
    expect(share.snapshotId).toBe(subchat1StorageInfo.snapshotId);
    expect(share.snapshotId).not.toBe(oldSnapshotId);

    if (!share.snapshotId) {
      throw new Error("No snapshot ID");
    }
    await verifyStoredContent(t, share.snapshotId, subchat1SnapshotContent);
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

    // Create a second subchat also without snapshot
    await createSubchat(t, chatId, sessionId);

    const subchat1Message: SerializedMessage = {
      id: "subchat1-msg1",
      role: "user",
      parts: [{ text: "Hello from subchat 1!", type: "text" }],
      createdAt: Date.now(),
    };
    await storeChat(t, chatId, sessionId, {
      messages: [subchat1Message],
      subchatIndex: 1,
    });

    // Verify we have storageState but no snapshot in subchat 0
    const storageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    expect(storageInfo).not.toBeNull();
    expect(storageInfo?.storageId).not.toBeNull();
    expect(storageInfo?.snapshotId).toBeUndefined();

    // Verify we have storageState but no snapshot in subchat 1
    const subchat1StorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 1,
    });
    expect(subchat1StorageInfo).not.toBeNull();
    expect(subchat1StorageInfo?.storageId).not.toBeNull();
    expect(subchat1StorageInfo?.snapshotId).toBeUndefined();

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

  test("cloning a chat copies over the subchat descriptions", async () => {
    const firstMessage: SerializedMessage = {
      id: "1",
      role: "user",
      parts: [{ text: "Hello, world!", type: "text" }],
      createdAt: Date.now(),
    };
    const { sessionId, chatId } = await initializeChat(t, firstMessage);

    // Create a second subchat
    await createSubchat(t, chatId, sessionId);

    // Add messages to the second subchat
    const subchat1Message: SerializedMessage = {
      id: "subchat1-msg1",
      role: "user",
      parts: [{ text: "Create a todo app with React!", type: "text" }],
      createdAt: Date.now(),
    };
    await storeChat(t, chatId, sessionId, {
      messages: [subchat1Message],
      snapshot: new Blob(["subchat 1 snapshot"]),
      subchatIndex: 1,
    });

    // Get the original chat doc to find the internal chat ID
    const originalChat = await t.run(async (ctx) => {
      return ctx.db
        .query("chats")
        .withIndex("byInitialId", (q) => q.eq("initialId", chatId))
        .first();
    });
    expect(originalChat).toBeDefined();

    // Add descriptions to both subchats using saveMessageSummary - get the LATEST states after storeChat
    const originalSubchatStates = await t.run(async (ctx) => {
      const subchat0State = await ctx.db
        .query("chatMessagesStorageState")
        .filter((q) => q.eq(q.field("chatId"), originalChat!._id))
        .filter((q) => q.eq(q.field("subchatIndex"), 0))
        .order("desc")
        .first();
      const subchat1State = await ctx.db
        .query("chatMessagesStorageState")
        .filter((q) => q.eq(q.field("chatId"), originalChat!._id))
        .filter((q) => q.eq(q.field("subchatIndex"), 1))
        .order("desc")
        .first();
      return { subchat0State, subchat1State };
    });

    expect(originalSubchatStates.subchat0State).toBeDefined();
    expect(originalSubchatStates.subchat1State).toBeDefined();

    await t.mutation(internal.summarize.saveMessageSummary, {
      chatMessageId: originalSubchatStates.subchat0State!._id,
      summary: "Initial greeting chat",
    });

    await t.mutation(internal.summarize.saveMessageSummary, {
      chatMessageId: originalSubchatStates.subchat1State!._id,
      summary: "Todo app creation",
    });

    const { code } = await t.mutation(api.share.create, { sessionId, id: chatId });
    expect(code).toBeDefined();

    const { id: clonedChatId } = await t.mutation(api.share.clone, {
      sessionId,
      shareCode: code,
      projectInitParams: testProjectInitParams,
    });
    expect(clonedChatId).toBeDefined();

    // Get the cloned chat doc to find the internal chat ID
    const clonedChat = await t.run(async (ctx) => {
      return ctx.db
        .query("chats")
        .withIndex("byInitialId", (q) => q.eq("initialId", clonedChatId))
        .first();
    });
    expect(clonedChat).toBeDefined();

    // Verify subchat descriptions were copied
    const clonedSubchatStates = await t.run(async (ctx) => {
      return ctx.db
        .query("chatMessagesStorageState")
        .filter((q) => q.eq(q.field("chatId"), clonedChat!._id))
        .collect();
    });

    const clonedSubchat0State = clonedSubchatStates.find((s) => s.subchatIndex === 0);
    const clonedSubchat1State = clonedSubchatStates.find((s) => s.subchatIndex === 1);

    expect(clonedSubchat0State).toBeDefined();
    expect(clonedSubchat1State).toBeDefined();
    expect(clonedSubchat0State!.description).toBe("Initial greeting chat");
    expect(clonedSubchat1State!.description).toBe("Todo app creation");
  });
});
