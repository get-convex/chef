import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { createChat, setupTest, storeChat, type TestConvex } from "./test.setup";
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
    await t.mutation(api.subchats.create, {
      chatId,
      sessionId,
    });

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
});
