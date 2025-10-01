import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import {
  createChat,
  createSubchat,
  setupTest,
  storeChat,
  verifyStoredContent,
  verifyStoredMessages,
  type TestConvex,
} from "./test.setup";
import { getChatByIdOrUrlIdEnsuringAccess, type SerializedMessage, type StorageInfo } from "./messages";
import type { Id } from "./_generated/dataModel";

function getChatStorageStates(t: TestConvex, chatId: string, sessionId: Id<"sessions">) {
  return t.run(async (ctx) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    if (!chat) {
      throw new Error("Chat not found");
    }
    return ctx.db
      .query("chatMessagesStorageState")
      .withIndex("byChatId", (q) => q.eq("chatId", chat._id))
      .collect();
  });
}

function createMessage(overrides: Partial<SerializedMessage> = {}): SerializedMessage {
  return {
    id: `test-${Math.random()}`,
    role: "user",
    content: "test",
    parts: [
      {
        type: "text",
        text: "test",
      },
    ],
    createdAt: Date.now(),
    ...overrides,
  };
}

async function assertStorageInfo(
  t: TestConvex,
  storageInfo: StorageInfo | null,
  options: {
    expectedMessages: SerializedMessage[] | null;
    expectedSnapshotContent: string | null;
    expectedLastMessageRank: number;
    expectedPartIndex: number;
    expectedSubchatIndex?: number;
  },
): Promise<void> {
  expect(storageInfo).not.toBeNull();
  if (storageInfo === null) {
    // Redundant with check above, but makes TypeScript happy
    throw new Error("No storage info");
  }
  if (options.expectedMessages) {
    expect(storageInfo.storageId).not.toBeNull();
    if (storageInfo.storageId === null) {
      throw new Error("No storage ID");
    }
    await verifyStoredMessages(t, storageInfo.storageId, options.expectedMessages);
  } else {
    expect(storageInfo.storageId).toBeNull();
  }
  if (options.expectedSnapshotContent) {
    expect(storageInfo.snapshotId).toBeDefined();
    if (storageInfo.snapshotId === undefined) {
      throw new Error("No snapshot ID");
    }
    await verifyStoredContent(t, storageInfo.snapshotId, options.expectedSnapshotContent);
  } else {
    expect(storageInfo.snapshotId).toBeUndefined();
  }
  expect(storageInfo.lastMessageRank).toBe(options.expectedLastMessageRank);
  expect(storageInfo.partIndex).toBe(options.expectedPartIndex);
  expect(storageInfo.subchatIndex).toBe(options.expectedSubchatIndex);
}

async function createSocialShare(t: TestConvex, chatId: string, sessionId: Id<"sessions">, code: string = "test123") {
  await t.run(async (ctx) => {
    await ctx.db.insert("socialShares", {
      chatId: (await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId }))!._id,
      code,
      allowForkFromLatest: true,
      shared: true,
      allowShowInGallery: true,
      linkToDeployed: true,
    });
  });
  return code;
}

describe("messages", () => {
  let t: TestConvex;
  beforeEach(async () => {
    vi.useFakeTimers();
    t = setupTest();
  });

  afterEach(async () => {
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    vi.useRealTimers();
  });

  test("sending messages", async () => {
    const { sessionId, chatId } = await createChat(t);

    const chats = await t.query(api.messages.getAll, {
      sessionId,
    });
    expect(chats.length).toBe(1);
    const chat = chats[0];
    expect(chat.id).toBe(chatId);
    expect(chat.initialId).toBe(chatId);
    expect(chat.urlId).toBeUndefined();
    expect(chat.description).toBeUndefined();
    expect(chat.timestamp).toBeDefined();
  });

  test("store messages", async () => {
    const { sessionId, chatId } = await createChat(t);
    const firstMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "Hello, world!", type: "text" }],
    });

    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage],
    });
    const initialMessagesStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    await assertStorageInfo(t, initialMessagesStorageInfo, {
      expectedMessages: [firstMessage],
      expectedSnapshotContent: null,
      expectedLastMessageRank: 0,
      expectedPartIndex: 0,
      expectedSubchatIndex: 0,
    });
  });

  test("remove chat", async () => {
    const { sessionId, chatId } = await createChat(t);
    await t.mutation(internal.messages.removeChat, { sessionId, id: chatId });
    const chats = await t.query(api.messages.getAll, {
      sessionId,
    });
    expect(chats.length).toBe(0);

    // Set description fails - uses getChatByIdOrUrlIdEnsuringAccess helper that should not include deleted chats
    await expect(
      t.mutation(api.messages.setDescription, { sessionId, id: chatId, description: "test" }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.messages.setCustomSystemPrompt, { sessionId, id: chatId, customSystemPrompt: "Prompt" }),
    ).rejects.toThrow();
  });

  test("set custom system prompt", async () => {
    const { sessionId, chatId } = await createChat(t);

    const prompt = "Use concise language.";
    await t.mutation(api.messages.setCustomSystemPrompt, { sessionId, id: chatId, customSystemPrompt: prompt });

    const chatWithPrompt = await t.query(api.messages.get, { sessionId, id: chatId });
    expect(chatWithPrompt?.customSystemPrompt).toBe(prompt);

    await t.mutation(api.messages.setCustomSystemPrompt, { sessionId, id: chatId, customSystemPrompt: null });
    const chatWithoutPrompt = await t.query(api.messages.get, { sessionId, id: chatId });
    expect(chatWithoutPrompt?.customSystemPrompt).toBeUndefined();

    const tooLongPrompt = "a".repeat(2001);
    await expect(
      t.mutation(api.messages.setCustomSystemPrompt, { sessionId, id: chatId, customSystemPrompt: tooLongPrompt }),
    ).rejects.toThrow("Custom system prompt must be at most 2000 characters long");
  });

  test("store chat without snapshot", async () => {
    // Note: this should be impossible from the UI since we will need to store
    // the initial snapshot, but we'll test it fore completeness
    const { sessionId, chatId } = await createChat(t);

    const firstMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "Hello, world!", type: "text" }],
    });

    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage],
    });

    const initialMessagesStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    await assertStorageInfo(t, initialMessagesStorageInfo, {
      expectedMessages: [firstMessage],
      expectedSnapshotContent: null,
      expectedLastMessageRank: 0,
      expectedPartIndex: 0,
      expectedSubchatIndex: 0,
    });

    const secondMessage: SerializedMessage = createMessage({
      role: "assistant",
      parts: [{ text: "How can I help you today?", type: "text" }],
    });

    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage, secondMessage],
    });

    const nextMessagesStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    await assertStorageInfo(t, nextMessagesStorageInfo, {
      expectedMessages: [firstMessage, secondMessage],
      expectedSnapshotContent: null,
      expectedLastMessageRank: 1,
      expectedPartIndex: 0,
      expectedSubchatIndex: 0,
    });

    // Should still have both message states in the table
    const allChatMessagesStorageStates = await getChatStorageStates(t, chatId, sessionId);
    // Intial chat record and two message states
    expect(allChatMessagesStorageStates.length).toBe(3);
  });

  test("store chat with snapshot", async () => {
    const { sessionId, chatId } = await createChat(t);

    const firstMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "Hello, world!", type: "text" }],
    });
    const initialSnapshotContent = "initial snapshot";
    const snapshotBlob = new Blob([initialSnapshotContent]);
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage],
      snapshot: snapshotBlob,
    });

    const initialMessagesStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    await assertStorageInfo(t, initialMessagesStorageInfo, {
      expectedMessages: [firstMessage],
      expectedSnapshotContent: initialSnapshotContent,
      expectedLastMessageRank: 0,
      expectedPartIndex: 0,
      expectedSubchatIndex: 0,
    });

    // Store second message without snapshot - should keep the old snapshot ID
    const secondMessage: SerializedMessage = createMessage({
      role: "assistant",
      parts: [{ text: "How can I help you today?", type: "text" }],
    });

    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage, secondMessage],
    });

    const nextMessagesStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    await assertStorageInfo(t, nextMessagesStorageInfo, {
      expectedMessages: [firstMessage, secondMessage],
      expectedSnapshotContent: initialSnapshotContent,
      expectedLastMessageRank: 1,
      expectedPartIndex: 0,
      expectedSubchatIndex: 0,
    });

    // Store only a new snapshot - should keep the old storage ID
    const updatedSnapshotContent = "updated snapshot";
    const updatedSnapshotBlob = new Blob([updatedSnapshotContent]);
    await storeChat(t, chatId, sessionId, {
      snapshot: updatedSnapshotBlob,
      messages: [firstMessage, secondMessage],
    });

    const finalMessagesStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    await assertStorageInfo(t, finalMessagesStorageInfo, {
      expectedMessages: [firstMessage, secondMessage],
      expectedSnapshotContent: updatedSnapshotContent,
      expectedLastMessageRank: 1,
      expectedPartIndex: 0,
      expectedSubchatIndex: 0,
    });

    // Should have all states in the table
    const allChatMessagesStorageStates = await getChatStorageStates(t, chatId, sessionId);
    // Initialize chat record, first message with snapshot, second message with old snapshot that later gets updated
    expect(allChatMessagesStorageStates.length).toBe(3);
  });

  test("rewind chat with snapshot", async () => {
    const { sessionId, chatId } = await createChat(t);
    const firstMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "Hello, world!", type: "text" }],
    });

    const initialSnapshotContent = "initial snapshot";
    const snapshotBlob = new Blob([initialSnapshotContent]);
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage],
      snapshot: snapshotBlob,
    });

    const initialMessagesStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    await assertStorageInfo(t, initialMessagesStorageInfo, {
      expectedMessages: [firstMessage],
      expectedSnapshotContent: initialSnapshotContent,
      expectedLastMessageRank: 0,
      expectedPartIndex: 0,
      expectedSubchatIndex: 0,
    });
    const secondMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "foobar", type: "text" }],
    });

    const updatedSnapshotContent = "updated snapshot";
    const updatedSnapshotBlob = new Blob([updatedSnapshotContent]);
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage, secondMessage],
      snapshot: updatedSnapshotBlob,
    });

    const nextMessagesStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    await assertStorageInfo(t, nextMessagesStorageInfo, {
      expectedMessages: [firstMessage, secondMessage],
      expectedSnapshotContent: updatedSnapshotContent,
      expectedLastMessageRank: 1,
      expectedPartIndex: 0,
      expectedSubchatIndex: 0,
    });

    // Should see lower lastMessageRank after rewinding
    await t.mutation(api.messages.rewindChat, { sessionId, chatId, subchatIndex: 0, lastMessageRank: 0 });
    const rewoundMessagesStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    await assertStorageInfo(t, rewoundMessagesStorageInfo, {
      expectedMessages: [firstMessage],
      expectedSnapshotContent: initialSnapshotContent,
      expectedLastMessageRank: 0,
      expectedPartIndex: 0,
      expectedSubchatIndex: 0,
    });

    // Should still have higher lastMessageRank state in the table
    const allChatMessagesStorageStates = await getChatStorageStates(t, chatId, sessionId);
    // Initialize chat record and first message with snapshot. The second message was deleted
    // because it was rewound to the first message.
    expect(allChatMessagesStorageStates.length).toBe(2);
  });

  test("sending message after rewind deletes future records when no share exists", async () => {
    const { sessionId, chatId } = await createChat(t);

    // Store first message with snapshot
    const firstMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "Hello, world!", type: "text" }],
    });
    const initialSnapshotContent = "initial snapshot";
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage],
      snapshot: new Blob([initialSnapshotContent]),
    });

    // Store second message with updated snapshot
    const secondMessage: SerializedMessage = createMessage({
      role: "assistant",
      parts: [{ text: "Hi there!", type: "text" }],
    });
    const updatedSnapshotContent = "updated snapshot";
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage, secondMessage],
      snapshot: new Blob([updatedSnapshotContent]),
    });

    // Get the storage info before rewinding
    const preRewindInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    await assertStorageInfo(t, preRewindInfo, {
      expectedMessages: [firstMessage, secondMessage],
      expectedSnapshotContent: updatedSnapshotContent,
      expectedLastMessageRank: 1,
      expectedPartIndex: 0,
      expectedSubchatIndex: 0,
    });
    const preRewindStorageId = preRewindInfo?.storageId;
    const preRewindSnapshotId = preRewindInfo?.snapshotId;
    if (!preRewindStorageId || !preRewindSnapshotId) {
      // Note: redundant with earlier assertions, but makes TypeScript happy
      throw new Error("No storage ID or snapshot ID");
    }

    // Rewind to first message
    await t.mutation(api.messages.rewindChat, { sessionId, chatId, subchatIndex: 0, lastMessageRank: 0 });

    // Send a new message after rewinding
    const newMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "New direction!", type: "text" }],
    });
    const newSnapshotContent = "new snapshot";
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage, newMessage],
      snapshot: new Blob([newSnapshotContent]),
    });

    // Verify that the old storage and snapshot blobs are deleted
    await t.run(async (ctx) => {
      const oldStorageBlob = await ctx.storage.get(preRewindStorageId);
      const oldSnapshotBlob = await ctx.storage.get(preRewindSnapshotId);
      expect(oldStorageBlob).toBeNull();
      expect(oldSnapshotBlob).toBeNull();
    });

    // Verify that old storage states are deleted
    const finalStorageStates = await getChatStorageStates(t, chatId, sessionId);
    // Should only have: initialize chat, first message, and new message states
    expect(finalStorageStates.length).toBe(3);
  });

  test("sending message after rewind preserves future records when share exists", async () => {
    const { sessionId, chatId } = await createChat(t);

    // Store first message with snapshot
    const firstMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "Hello, world!", type: "text" }],
    });
    const initialSnapshotContent = "initial snapshot";
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage],
      snapshot: new Blob([initialSnapshotContent]),
    });

    // Store second message with updated snapshot
    const secondMessage: SerializedMessage = createMessage({
      role: "assistant",
      parts: [{ text: "Hi there!", type: "text" }],
    });
    const updatedSnapshotContent = "updated snapshot";
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage, secondMessage],
      snapshot: new Blob([updatedSnapshotContent]),
    });

    // Create a share of the chat
    const { code } = await t.mutation(api.share.create, { sessionId, id: chatId });
    expect(code).toBeDefined();

    // Get the storage info before rewinding
    const preRewindInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    await assertStorageInfo(t, preRewindInfo, {
      expectedMessages: [firstMessage, secondMessage],
      expectedSnapshotContent: updatedSnapshotContent,
      expectedLastMessageRank: 1,
      expectedPartIndex: 0,
      expectedSubchatIndex: 0,
    });

    // Rewind to first message
    await t.mutation(api.messages.rewindChat, { sessionId, chatId, subchatIndex: 0, lastMessageRank: 0 });

    // Send a new message after rewinding
    const newMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "New direction!", type: "text" }],
    });
    const newSnapshotContent = "new snapshot";
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage, newMessage],
      snapshot: new Blob([newSnapshotContent]),
    });

    // Verify that the shared chat references the history and snapshot before the rewind
    const share = await t.run(async (ctx) => {
      const share = await ctx.db
        .query("shares")
        .withIndex("byCode", (q) => q.eq("code", code))
        .first();
      return share;
    });
    await assertStorageInfo(
      t,
      {
        storageId: share?.chatHistoryId,
        snapshotId: share?.snapshotId,
        lastMessageRank: share?.lastMessageRank,
        partIndex: share?.partIndex,
        subchatIndex: share?.lastSubchatIndex,
      },
      {
        expectedMessages: [firstMessage, secondMessage],
        expectedSnapshotContent: updatedSnapshotContent,
        expectedLastMessageRank: 1,
        expectedPartIndex: 0,
        expectedSubchatIndex: 0,
      },
    );

    const finalStorageStates = await getChatStorageStates(t, chatId, sessionId);
    // Should have: initialize chat, first message, and new message overriding the second message
    expect(finalStorageStates.length).toBe(3);
    const newestMessage = finalStorageStates[2];
    await assertStorageInfo(t, newestMessage, {
      expectedMessages: [firstMessage, newMessage],
      expectedSnapshotContent: newSnapshotContent,
      expectedLastMessageRank: 1,
      expectedPartIndex: 0,
      expectedSubchatIndex: 0,
    });
  });

  test("sending message after rewind preserves snapshots referenced by previous chatMessageStorageState", async () => {
    const { sessionId, chatId } = await createChat(t);

    // Store first message with snapshot
    const firstMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "Hello, world!", type: "text" }],
    });
    const initialSnapshotContent = "initial snapshot content";
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage],
      snapshot: new Blob([initialSnapshotContent]),
    });

    // Get the first storage state to verify its snapshot later
    const firstStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    await assertStorageInfo(t, firstStorageInfo, {
      expectedMessages: [firstMessage],
      expectedSnapshotContent: initialSnapshotContent,
      expectedLastMessageRank: 0,
      expectedPartIndex: 0,
      expectedSubchatIndex: 0,
    });

    // Store second message with the same snapshot (using doNotUpdateMessages to keep the snapshot reference)
    const secondMessage: SerializedMessage = createMessage({
      role: "assistant",
      parts: [{ text: "Hi there!", type: "text" }],
    });
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage, secondMessage],
    });

    // Verify both states have the same snapshot ID
    const secondStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    await assertStorageInfo(t, secondStorageInfo, {
      expectedMessages: [firstMessage, secondMessage],
      expectedSnapshotContent: initialSnapshotContent,
      expectedLastMessageRank: 1,
      expectedPartIndex: 0,
      expectedSubchatIndex: 0,
    });

    // Rewind to first message
    await t.mutation(api.messages.rewindChat, { sessionId, chatId, subchatIndex: 0, lastMessageRank: 0 });

    // Send a new message with a different snapshot
    const newMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "New direction!", type: "text" }],
    });
    const newSnapshotContent = "new snapshot content";
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage, newMessage],
      snapshot: new Blob([newSnapshotContent]),
    });

    // Verify we have the expected number of storage states
    const finalStorageStates = await getChatStorageStates(t, chatId, sessionId);
    expect(finalStorageStates.length).toBe(3);
    await assertStorageInfo(t, finalStorageStates[2], {
      expectedMessages: [firstMessage, newMessage],
      expectedSnapshotContent: newSnapshotContent,
      expectedLastMessageRank: 1,
      expectedPartIndex: 0,
      expectedSubchatIndex: 0,
    });
    // Importantly, the snapshot is still there since it's referenced by the previous chatMessageStorageState
    await assertStorageInfo(t, finalStorageStates[1], {
      expectedMessages: [firstMessage],
      expectedSnapshotContent: initialSnapshotContent,
      expectedLastMessageRank: 0,
      expectedPartIndex: 0,
      expectedSubchatIndex: 0,
    });
  });

  test("rewinding to a previous subchat deletes all storage states for future subchats", async () => {
    const { sessionId, chatId } = await createChat(t);

    // Store initial message in subchat 0
    const subchat0Message: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "Hello from subchat 0!", type: "text" }],
    });
    await storeChat(t, chatId, sessionId, {
      messages: [subchat0Message],
      snapshot: new Blob(["subchat 0 snapshot"]),
      subchatIndex: 0,
    });

    // Create subchat 1
    await createSubchat(t, chatId, sessionId);
    const subchat1Message: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "Hello from subchat 1!", type: "text" }],
    });
    await storeChat(t, chatId, sessionId, {
      messages: [subchat1Message],
      snapshot: new Blob(["subchat 1 snapshot"]),
      subchatIndex: 1,
    });

    // Create subchat 2
    await createSubchat(t, chatId, sessionId);
    const subchat2Message: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "Hello from subchat 2!", type: "text" }],
    });
    await storeChat(t, chatId, sessionId, {
      messages: [subchat2Message],
      snapshot: new Blob(["subchat 2 snapshot"]),
      subchatIndex: 2,
    });

    // Verify we have 2 storage states for all subchats (initial chat record + 1 message)
    const allStorageStates = await getChatStorageStates(t, chatId, sessionId);
    expect(allStorageStates.filter((s) => s.subchatIndex === 0).length).toBe(1);
    expect(allStorageStates.filter((s) => s.subchatIndex === 1).length).toBe(1);
    expect(allStorageStates.filter((s) => s.subchatIndex === 2).length).toBe(2);

    // Rewind to subchat 0
    await t.mutation(api.messages.rewindChat, {
      sessionId,
      chatId,
      subchatIndex: 0,
      lastMessageRank: 0,
    });

    // Verify that storage states for subchats 1 and 2 are deleted
    const remainingStorageStates = await getChatStorageStates(t, chatId, sessionId);
    expect(remainingStorageStates.filter((s) => s.subchatIndex === 0).length).toBe(1);
    expect(remainingStorageStates.filter((s) => s.subchatIndex === 1).length).toBe(0);
    expect(remainingStorageStates.filter((s) => s.subchatIndex === 2).length).toBe(0);

    // Verify subchat 0 data is still accessible with the new message
    const subchat0StorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    await assertStorageInfo(t, subchat0StorageInfo, {
      expectedMessages: [subchat0Message],
      expectedSnapshotContent: "subchat 0 snapshot",
      expectedLastMessageRank: 0,
      expectedPartIndex: 0,
      expectedSubchatIndex: 0,
    });

    // Verify subchats 1 and 2 data is no longer accessible
    const subchat1StorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 1,
    });
    expect(subchat1StorageInfo).toBeNull();

    const subchat2StorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 2,
    });
    expect(subchat2StorageInfo).toBeNull();
  });

  test("storageId cannot be null if there exist previous storageId for the chat", async () => {
    const { sessionId, chatId } = await createChat(t);
    await storeChat(t, chatId, sessionId, {
      snapshot: new Blob(["initial snapshot content"]),
      messages: [createMessage({ role: "user", parts: [{ text: "Hello, world!", type: "text" }] })],
    });
    await storeChat(
      t,
      chatId,
      sessionId,
      {
        snapshot: new Blob(["new snapshot content"]),
      },
      true,
    );
  });

  test("snapshotId should not be deleted if it is referenced by earlier chatMessagesStorageStates", async () => {
    const { sessionId, chatId } = await createChat(t);
    const snapshotId1 = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["initial snapshot content"]));
    });
    const snapshotId2 = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["second snapshot content"]));
    });
    const storageId1 = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["initial storage content"]));
    });
    const storageId2 = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["second storage content"]));
    });
    const storageId3 = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["third storage content"]));
    });
    await t.mutation(internal.messages.updateStorageState, {
      sessionId,
      chatId,
      storageId: storageId1,
      lastMessageRank: 0,
      partIndex: 0,
      subchatIndex: 0,
      snapshotId: snapshotId1,
    });
    await t.mutation(internal.messages.updateStorageState, {
      sessionId,
      chatId,
      storageId: storageId2,
      lastMessageRank: 1,
      partIndex: 0,
      subchatIndex: 0,
      snapshotId: snapshotId1,
    });
    // This update SHOULD NOT delete `snapshotId1` because it is referenced by the previous storage state.
    await t.mutation(internal.messages.updateStorageState, {
      sessionId,
      chatId,
      storageId: storageId3,
      lastMessageRank: 1,
      partIndex: 1,
      subchatIndex: 0,
      snapshotId: snapshotId2,
    });
    const snapshot1 = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(snapshotId1);
    });
    const snapshot2 = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(snapshotId2);
    });
    expect(snapshot1).not.toBeNull();
    expect(snapshot2).not.toBeNull();
  });

  test("patches existing document and cleans up storage when receiving update with same lastMessageRank", async () => {
    const { sessionId, chatId } = await createChat(t);

    // Store first message with snapshot
    const firstMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "Hello, world!", type: "text" }],
    });
    const initialSnapshotContent = "initial snapshot";
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage],
      snapshot: new Blob([initialSnapshotContent]),
    });

    // Get initial storage info
    const initialStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    await assertStorageInfo(t, initialStorageInfo, {
      expectedMessages: [firstMessage],
      expectedSnapshotContent: initialSnapshotContent,
      expectedLastMessageRank: 0,
      expectedPartIndex: 0,
      expectedSubchatIndex: 0,
    });
    const firstStorageState = await getChatStorageStates(t, chatId, sessionId);
    // Should only have 2 states: initial chat record and the new message state
    expect(firstStorageState.length).toBe(2);

    // Store update with same lastMessageRank but different content
    const updatedMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [
        { text: "Hello, world!", type: "text" },
        { text: "Updated message!", type: "text" },
      ],
    });
    const updatedSnapshotContent = "updated snapshot";
    await storeChat(t, chatId, sessionId, {
      messages: [updatedMessage],
      snapshot: new Blob([updatedSnapshotContent]),
    });

    // Verify storage states
    const finalStorageStates = await getChatStorageStates(t, chatId, sessionId);
    // Should only have 2 states: initial chat record and the updated message state
    expect(finalStorageStates.length).toBe(2);

    // Verify the updated state
    const updatedStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    await assertStorageInfo(t, updatedStorageInfo, {
      expectedMessages: [updatedMessage],
      expectedSnapshotContent: updatedSnapshotContent,
      expectedLastMessageRank: 0,
      expectedPartIndex: 1,
      expectedSubchatIndex: 0,
    });

    // Verify old storage files are deleted
    await t.run(async (ctx) => {
      if (initialStorageInfo?.storageId) {
        const oldStorageBlob = await ctx.storage.get(initialStorageInfo.storageId);
        expect(oldStorageBlob).toBeNull();
      }
      if (initialStorageInfo?.snapshotId) {
        const oldSnapshotBlob = await ctx.storage.get(initialStorageInfo.snapshotId);
        expect(oldSnapshotBlob).toBeNull();
      }
    });
  });

  test("preserves previous snapshotId when new snapshotId is null", async () => {
    const { sessionId, chatId } = await createChat(t);

    // Store first message with snapshot
    const firstMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "Hello, world!", type: "text" }],
    });
    const initialSnapshotContent = "initial snapshot";
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage],
      snapshot: new Blob([initialSnapshotContent]),
    });

    // Get initial storage info
    const initialStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    await assertStorageInfo(t, initialStorageInfo, {
      expectedMessages: [firstMessage],
      expectedSnapshotContent: initialSnapshotContent,
      expectedLastMessageRank: 0,
      expectedPartIndex: 0,
      expectedSubchatIndex: 0,
    });

    // Store update with same lastMessageRank but no snapshotId
    const updatedMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [
        { text: "Hello, world!", type: "text" },
        { text: "Updated message!", type: "text" },
      ],
    });
    await storeChat(t, chatId, sessionId, {
      messages: [updatedMessage],
    });

    // Verify storage states
    const finalStorageStates = await getChatStorageStates(t, chatId, sessionId);
    // Should only have 2 states: initial chat record and the updated message state
    expect(finalStorageStates.length).toBe(2);

    // Verify the updated state still has the original snapshotId
    const updatedStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    await assertStorageInfo(t, updatedStorageInfo, {
      expectedMessages: [updatedMessage],
      expectedSnapshotContent: initialSnapshotContent, // Should still have the original snapshot content
      expectedLastMessageRank: 0,
      expectedPartIndex: 1,
      expectedSubchatIndex: 0,
    });
  });

  test("preserves storageId referenced by share when updating storage state with same lastMessageRank", async () => {
    const { sessionId, chatId } = await createChat(t);

    // Store first message
    const firstMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "Hello, world!", type: "text" }],
    });
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage],
      snapshot: new Blob(["initial snapshot content"]),
    });

    // Get initial storage info
    const initialStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    await assertStorageInfo(t, initialStorageInfo, {
      expectedMessages: [firstMessage],
      expectedSnapshotContent: "initial snapshot content",
      expectedLastMessageRank: 0,
      expectedPartIndex: 0,
      expectedSubchatIndex: 0,
    });

    // Create a share that references the storage ID
    const { code: shareCode } = await t.mutation(api.share.create, { sessionId, id: chatId });

    // Store update with same lastMessageRank but different content
    const updatedMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [
        { text: "Hello, world!", type: "text" },
        { text: "Updated message!", type: "text" },
      ],
    });
    await storeChat(t, chatId, sessionId, {
      messages: [updatedMessage],
      snapshot: new Blob(["updated snapshot content"]),
    });

    // Verify storage states
    const finalStorageStates = await getChatStorageStates(t, chatId, sessionId);
    // Should only have 2 states: initial chat record and the updated message state
    expect(finalStorageStates.length).toBe(2);

    // Verify the updated state has different storage ID
    const updatedStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    expect(updatedStorageInfo?.storageId).not.toBe(initialStorageInfo?.storageId);
    expect(updatedStorageInfo?.snapshotId).not.toBe(initialStorageInfo?.snapshotId);

    // Verify the share still references the same storage ID
    const share = await t.run(async (ctx) => {
      return await ctx.db
        .query("shares")
        .withIndex("byCode", (q) => q.eq("code", shareCode))
        .unique();
    });
    console.log(initialStorageInfo);
    expect(share?.chatHistoryId).toBe(initialStorageInfo?.storageId);

    // Verify the storage blob still exists
    await t.run(async (ctx) => {
      if (initialStorageInfo?.storageId) {
        const storageBlob = await ctx.storage.get(initialStorageInfo.storageId);
        expect(storageBlob).not.toBeNull();
      } else {
        throw new Error("No storage ID found");
      }

      if (initialStorageInfo?.snapshotId) {
        const snapshotBlob = await ctx.storage.get(initialStorageInfo.snapshotId);
        expect(snapshotBlob).not.toBeNull();
      } else {
        throw new Error("No snapshot ID found");
      }
    });
  });
});

describe("eraseMessageHistory", () => {
  let t: TestConvex;
  beforeEach(async () => {
    vi.useFakeTimers();
    t = setupTest();
  });

  afterEach(async () => {
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    vi.useRealTimers();
  });

  test("successfully erases message history and rewinds chat", async () => {
    const { sessionId, chatId } = await createChat(t);

    // Create initial messages and snapshot
    const firstMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "Hello, world!", type: "text" }],
    });
    const initialSnapshotContent = "initial snapshot";
    const snapshotBlob = new Blob([initialSnapshotContent]);
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage],
      snapshot: snapshotBlob,
    });

    // Add more messages
    const secondMessage: SerializedMessage = createMessage({
      role: "assistant",
      parts: [{ text: "How can I help you today?", type: "text" }],
    });
    const nextSnapshotContent = "final snapshot";
    const nextSnapshotBlob = new Blob([nextSnapshotContent]);
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage, secondMessage],
      snapshot: nextSnapshotBlob,
    });

    // Create a social share
    const shareCode = await createSocialShare(t, chatId, sessionId);

    // Erase message history
    await t.mutation(internal.messages.eraseMessageHistory, {
      shareCode,
      dryRun: false,
    });

    // Verify chat was rewound to first message
    const chat = await t.run(async (ctx) => {
      return await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    });
    expect(chat?.lastMessageRank).toBe(0);

    // Verify snapshot state was updated with most recent snapshot
    const storageStates = await getChatStorageStates(t, chatId, sessionId);
    const earliestStorageStateWithSnapshot = storageStates[1];
    const latestStorageState = storageStates[storageStates.length - 1];
    expect(earliestStorageStateWithSnapshot.snapshotId).toBe(latestStorageState.snapshotId);
    expect(latestStorageState.snapshotId).toBeDefined();
  });

  test("dry run does not update chat or filesystem snapshot", async () => {
    const { sessionId, chatId } = await createChat(t);

    // Create initial messages and snapshot
    const firstMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "Hello, world!", type: "text" }],
    });
    const initialSnapshotContent = "initial snapshot";
    const snapshotBlob = new Blob([initialSnapshotContent]);
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage],
      snapshot: snapshotBlob,
    });

    // Add more messages
    const secondMessage: SerializedMessage = createMessage({
      role: "assistant",
      parts: [{ text: "How can I help you today?", type: "text" }],
    });
    const nextSnapshotContent = "final snapshot";
    const nextSnapshotBlob = new Blob([nextSnapshotContent]);
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage, secondMessage],
      snapshot: nextSnapshotBlob,
    });

    // Create a social share
    const shareCode = await createSocialShare(t, chatId, sessionId);

    // Erase message history
    await t.mutation(internal.messages.eraseMessageHistory, {
      shareCode,
      dryRun: true,
    });

    // Verify chat was not rewound
    const chat = await t.run(async (ctx) => {
      return await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
    });
    expect(chat?.lastMessageRank).toBe(undefined);

    // Verify snapshot state was not updated
    const storageStates = await getChatStorageStates(t, chatId, sessionId);
    const earliestStorageStateWithSnapshot = storageStates[1];
    const latestStorageState = storageStates[storageStates.length - 1];
    expect(earliestStorageStateWithSnapshot.snapshotId).not.toBe(latestStorageState.snapshotId);
  });

  test("throws error when share not found", async () => {
    await expect(
      t.mutation(internal.messages.eraseMessageHistory, {
        shareCode: "nonexistent",
        dryRun: false,
      }),
    ).rejects.toThrow("Share not found");
  });

  test("throws error when no storage state found", async () => {
    const { sessionId, chatId } = await createChat(t);

    // Create a social share without any storage state
    const shareCode = await createSocialShare(t, chatId, sessionId);

    await expect(
      t.mutation(internal.messages.eraseMessageHistory, {
        shareCode,
        dryRun: false,
      }),
    ).rejects.toThrow("No filesystem snapshot found for chat");
  });

  test("throws error when no filesystem snapshot found", async () => {
    const { sessionId, chatId } = await createChat(t);

    // Create messages without snapshot
    const firstMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "Hello, world!", type: "text" }],
    });
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage],
    });

    // Create a social share
    const shareCode = await createSocialShare(t, chatId, sessionId);

    await expect(
      t.mutation(internal.messages.eraseMessageHistory, {
        shareCode,
        dryRun: false,
      }),
    ).rejects.toThrow("No filesystem snapshot found for chat");
  });

  test("throws error when no message with snapshot found", async () => {
    const { sessionId, chatId } = await createChat(t);

    // Create initial messages with snapshot
    const firstMessage: SerializedMessage = createMessage({
      role: "user",
      parts: [{ text: "Hello, world!", type: "text" }],
    });
    const initialSnapshotContent = "initial snapshot";
    const snapshotBlob = new Blob([initialSnapshotContent]);
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage],
      snapshot: snapshotBlob,
    });

    // Create a social share
    const shareCode = await createSocialShare(t, chatId, sessionId);

    // Delete all storage states with snapshots
    await t.run(async (ctx) => {
      const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id: chatId, sessionId });
      const storageStates = await ctx.db
        .query("chatMessagesStorageState")
        .withIndex("byChatId", (q) => q.eq("chatId", chat!._id))
        .collect();
      for (const state of storageStates) {
        await ctx.db.patch(state._id, { snapshotId: undefined });
      }
    });

    await expect(
      t.mutation(internal.messages.eraseMessageHistory, {
        shareCode,
        dryRun: false,
      }),
    ).rejects.toThrow("No filesystem snapshot found for chat");
  });
});
