import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import {
  createChat,
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
    });
    await assertStorageInfo(t, initialMessagesStorageInfo, {
      expectedMessages: [firstMessage],
      expectedSnapshotContent: null,
      expectedLastMessageRank: 0,
      expectedPartIndex: 0,
    });
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
    });
    await assertStorageInfo(t, initialMessagesStorageInfo, {
      expectedMessages: [firstMessage],
      expectedSnapshotContent: null,
      expectedLastMessageRank: 0,
      expectedPartIndex: 0,
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
    });
    await assertStorageInfo(t, nextMessagesStorageInfo, {
      expectedMessages: [firstMessage, secondMessage],
      expectedSnapshotContent: null,
      expectedLastMessageRank: 1,
      expectedPartIndex: 0,
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
    });
    await assertStorageInfo(t, initialMessagesStorageInfo, {
      expectedMessages: [firstMessage],
      expectedSnapshotContent: initialSnapshotContent,
      expectedLastMessageRank: 0,
      expectedPartIndex: 0,
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
    });
    await assertStorageInfo(t, nextMessagesStorageInfo, {
      expectedMessages: [firstMessage, secondMessage],
      expectedSnapshotContent: initialSnapshotContent,
      expectedLastMessageRank: 1,
      expectedPartIndex: 0,
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
    });
    await assertStorageInfo(t, finalMessagesStorageInfo, {
      expectedMessages: [firstMessage, secondMessage],
      expectedSnapshotContent: updatedSnapshotContent,
      expectedLastMessageRank: 1,
      expectedPartIndex: 0,
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
    });
    await assertStorageInfo(t, initialMessagesStorageInfo, {
      expectedMessages: [firstMessage],
      expectedSnapshotContent: initialSnapshotContent,
      expectedLastMessageRank: 0,
      expectedPartIndex: 0,
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
    });
    await assertStorageInfo(t, nextMessagesStorageInfo, {
      expectedMessages: [firstMessage, secondMessage],
      expectedSnapshotContent: updatedSnapshotContent,
      expectedLastMessageRank: 1,
      expectedPartIndex: 0,
    });

    // Should see lower lastMessageRank after rewinding
    await t.mutation(api.messages.rewindChat, { sessionId, chatId, lastMessageRank: 0 });
    const rewoundMessagesStorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
    });
    await assertStorageInfo(t, rewoundMessagesStorageInfo, {
      expectedMessages: [firstMessage],
      expectedSnapshotContent: initialSnapshotContent,
      expectedLastMessageRank: 0,
      expectedPartIndex: 0,
    });

    // Should still have higher lastMessageRank state in the table
    const allChatMessagesStorageStates = await getChatStorageStates(t, chatId, sessionId);
    // Initialize chat record, first message with snapshot, and second message with updated snapshot
    expect(allChatMessagesStorageStates.length).toBe(3);
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
    });
    await assertStorageInfo(t, preRewindInfo, {
      expectedMessages: [firstMessage, secondMessage],
      expectedSnapshotContent: updatedSnapshotContent,
      expectedLastMessageRank: 1,
      expectedPartIndex: 0,
    });
    const preRewindStorageId = preRewindInfo?.storageId;
    const preRewindSnapshotId = preRewindInfo?.snapshotId;
    if (!preRewindStorageId || !preRewindSnapshotId) {
      // Note: redundant with earlier assertions, but makes TypeScript happy
      throw new Error("No storage ID or snapshot ID");
    }

    // Rewind to first message
    await t.mutation(api.messages.rewindChat, { sessionId, chatId, lastMessageRank: 0 });

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
    });
    await assertStorageInfo(t, preRewindInfo, {
      expectedMessages: [firstMessage, secondMessage],
      expectedSnapshotContent: updatedSnapshotContent,
      expectedLastMessageRank: 1,
      expectedPartIndex: 0,
    });

    // Rewind to first message
    await t.mutation(api.messages.rewindChat, { sessionId, chatId, lastMessageRank: 0 });

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
      },
      {
        expectedMessages: [firstMessage, secondMessage],
        expectedSnapshotContent: updatedSnapshotContent,
        expectedLastMessageRank: 1,
        expectedPartIndex: 0,
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
    });
    await assertStorageInfo(t, firstStorageInfo, {
      expectedMessages: [firstMessage],
      expectedSnapshotContent: initialSnapshotContent,
      expectedLastMessageRank: 0,
      expectedPartIndex: 0,
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
    });
    await assertStorageInfo(t, secondStorageInfo, {
      expectedMessages: [firstMessage, secondMessage],
      expectedSnapshotContent: initialSnapshotContent,
      expectedLastMessageRank: 1,
      expectedPartIndex: 0,
    });

    // Rewind to first message
    await t.mutation(api.messages.rewindChat, { sessionId, chatId, lastMessageRank: 0 });

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
    });
    // Importantly, the snapshot is still there since it's referenced by the previous chatMessageStorageState
    await assertStorageInfo(t, finalStorageStates[1], {
      expectedMessages: [firstMessage],
      expectedSnapshotContent: initialSnapshotContent,
      expectedLastMessageRank: 0,
      expectedPartIndex: 0,
    });
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
      "No messages stored",
    );
  });
});
