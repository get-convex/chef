import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { createChat, createSubchat, setupTest, storeChat, type TestConvex } from "./test.setup";
import type { SerializedMessage } from "./messages";
import { describe } from "node:test";

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

function getChatStorageStates(t: TestConvex, chatId: string) {
  return t.run(async (ctx) => {
    const chat = await ctx.db
      .query("chats")
      .withIndex("byInitialId", (q) => q.eq("initialId", chatId))
      .first();
    if (!chat) {
      throw new Error("Chat not found");
    }
    return ctx.db
      .query("chatMessagesStorageState")
      .withIndex("byChatId", (q) => q.eq("chatId", chat._id))
      .collect();
  });
}

describe("subchats", () => {
  let t: TestConvex;
  beforeEach(() => {
    vi.useFakeTimers();
    t = setupTest();
  });

  afterEach(async () => {
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    vi.useRealTimers();
  });

  test("creates chat with messages in different subchats and verifies initial_messages returns correct results", async () => {
    const { sessionId, chatId } = await createChat(t);

    // Create messages for subchat 0 (default)
    const subchat0Message1: SerializedMessage = createMessage({
      id: "subchat0-msg1",
      role: "user",
      parts: [{ text: "Hello from subchat 0!", type: "text" }],
    });
    const subchat0Message2: SerializedMessage = createMessage({
      id: "subchat0-msg2",
      role: "assistant",
      parts: [{ text: "Response from subchat 0!", type: "text" }],
    });

    // Store messages for subchat 0s
    await storeChat(t, chatId, sessionId, {
      messages: [subchat0Message1, subchat0Message2],
      snapshot: new Blob(["subchat 0 snapshot"]),
    });

    // Create messages for subchat 1
    const subchat1Message1: SerializedMessage = createMessage({
      id: "subchat1-msg1",
      role: "user",
      parts: [{ text: "Hello from subchat 1!", type: "text" }],
    });
    const subchat1Message2: SerializedMessage = createMessage({
      id: "subchat1-msg2",
      role: "assistant",
      parts: [{ text: "Response from subchat 1!", type: "text" }],
    });

    // Create a new subchat
    await createSubchat(t, chatId, sessionId);

    // Confirm that the subchat was created
    const subchats = await t.query(api.subchats.get, {
      chatId,
      sessionId,
    });
    expect(subchats).toHaveLength(2);

    const chatInfo = await t.query(api.messages.get, {
      id: chatId,
      sessionId,
    });
    expect(chatInfo).not.toBeNull();
    expect(chatInfo?.subchatIndex).toBe(1);

    await storeChat(t, chatId, sessionId, {
      messages: [subchat1Message1, subchat1Message2],
      snapshot: new Blob(["subchat 1 snapshot"]),
      subchatIndex: 1,
    });

    // Test /initial_messages for subchat 0
    const subchat0Response = await t.fetch("/initial_messages", {
      method: "POST",
      body: JSON.stringify({
        chatId,
        sessionId,
        subchatIndex: 0,
      }),
    });
    const subchat0Messages = await subchat0Response.json();

    expect(subchat0Messages.length).toBe(2);
    expect(subchat0Messages[0]).toMatchObject(subchat0Message1);
    expect(subchat0Messages[1]).toMatchObject(subchat0Message2);

    // Test /initial_messages for subchat 1
    const subchat1Response = await t.fetch("/initial_messages", {
      method: "POST",
      body: JSON.stringify({
        chatId,
        sessionId,
        subchatIndex: 1,
      }),
    });
    const subchat1Messages = await subchat1Response.json();

    expect(subchat1Messages.length).toBe(2);
    expect(subchat1Messages[0]).toMatchObject(subchat1Message1);
    expect(subchat1Messages[1]).toMatchObject(subchat1Message2);

    // Verify storage info for both subchats
    const subchat0StorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 0,
    });
    expect(subchat0StorageInfo).not.toBeNull();
    expect(subchat0StorageInfo?.lastMessageRank).toBe(1);
    expect(subchat0StorageInfo?.subchatIndex).toBe(0);

    const subchat1StorageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
      subchatIndex: 1,
    });
    expect(subchat1StorageInfo).not.toBeNull();
    expect(subchat1StorageInfo?.lastMessageRank).toBe(1);
    expect(subchat1StorageInfo?.subchatIndex).toBe(1);
  });

  test("creating new subchat deletes all storage states from previous subchat except latest", async () => {
    const { sessionId, chatId } = await createChat(t);

    // Setup subchat 0 with multiple messages
    const firstMessage: SerializedMessage = createMessage({
      id: "msg1",
      role: "user",
      parts: [{ text: "First message", type: "text" }],
    });
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage],
      snapshot: new Blob(["first snapshot"]),
    });

    const secondMessage: SerializedMessage = createMessage({
      id: "msg2",
      role: "assistant",
      parts: [{ text: "Second message", type: "text" }],
    });
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage, secondMessage],
      snapshot: new Blob(["second snapshot"]),
    });

    const thirdMessage: SerializedMessage = createMessage({
      id: "msg3",
      role: "user",
      parts: [{ text: "Third message", type: "text" }],
    });
    await storeChat(t, chatId, sessionId, {
      messages: [firstMessage, secondMessage, thirdMessage],
      snapshot: new Blob(["third snapshot"]),
    });

    // Verify subchat 0 has multiple messages
    const storageStatesBeforeNewSubchat = await getChatStorageStates(t, chatId);
    expect(storageStatesBeforeNewSubchat).toHaveLength(4);

    const subchat0StatesBefore = storageStatesBeforeNewSubchat.filter((s) => s.subchatIndex === 0);
    expect(subchat0StatesBefore).toHaveLength(4);

    const latestSubchat0State = subchat0StatesBefore.find((s) => s.lastMessageRank === 2);
    expect(latestSubchat0State).toBeDefined();

    // Create subchat 1 and add messages
    await createSubchat(t, chatId, sessionId);

    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    const subchat1Message1: SerializedMessage = createMessage({
      id: "subchat1-msg1",
      role: "user",
      parts: [{ text: "First message in subchat 1", type: "text" }],
    });
    await storeChat(t, chatId, sessionId, {
      messages: [subchat1Message1],
      snapshot: new Blob(["subchat 1 first snapshot"]),
      subchatIndex: 1,
    });

    const subchat1Message2: SerializedMessage = createMessage({
      id: "subchat1-msg2",
      role: "assistant",
      parts: [{ text: "Second message in subchat 1", type: "text" }],
    });
    await storeChat(t, chatId, sessionId, {
      messages: [subchat1Message1, subchat1Message2],
      snapshot: new Blob(["subchat 1 second snapshot"]),
      subchatIndex: 1,
    });

    // Verify subchat 1 has multiple messages
    const storageStatesBeforeSubchat2 = await getChatStorageStates(t, chatId);
    const subchat1StatesBefore = storageStatesBeforeSubchat2.filter((s) => s.subchatIndex === 1);
    expect(subchat1StatesBefore).toHaveLength(3);

    const latestSubchat1State = subchat1StatesBefore.find((s) => s.lastMessageRank === 1);
    expect(latestSubchat1State).toBeDefined();

    // Create subchat 2 - should clean up previous subchat intermediate states
    await createSubchat(t, chatId, sessionId);

    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    // Verify cleanup: only latest state from each subchat remains
    const storageStatesAfterSubchat2 = await getChatStorageStates(t, chatId);
    expect(storageStatesAfterSubchat2).toHaveLength(3);

    const subchat0StatesAfter = storageStatesAfterSubchat2.filter((s) => s.subchatIndex === 0);
    const subchat1StatesAfter = storageStatesAfterSubchat2.filter((s) => s.subchatIndex === 1);
    const subchat2StatesAfter = storageStatesAfterSubchat2.filter((s) => s.subchatIndex === 2);

    expect(subchat0StatesAfter).toHaveLength(1);
    expect(subchat1StatesAfter).toHaveLength(1);
    expect(subchat2StatesAfter).toHaveLength(1);

    const remainingSubchat0State = subchat0StatesAfter.find((s) => s.lastMessageRank === 2);
    expect(remainingSubchat0State).toBeDefined();
    expect(remainingSubchat0State?._id).toBe(latestSubchat0State?._id);

    const remainingSubchat1State = subchat1StatesAfter.find((s) => s.lastMessageRank === 1);
    expect(remainingSubchat1State).toBeDefined();
    expect(remainingSubchat1State?._id).toBe(latestSubchat1State?._id);

    const subchat1IntermediateStates = subchat1StatesAfter.filter((s) => s.lastMessageRank === 0);
    expect(subchat1IntermediateStates).toHaveLength(0);

    const subchat2InitialState = subchat2StatesAfter.find((s) => s.lastMessageRank === -1);
    expect(subchat2InitialState).toBeDefined();
  });
});
