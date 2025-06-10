import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { setupTest, type TestConvex } from "./test.setup";

describe("cleanup", () => {
  let t: TestConvex;
  beforeEach(async () => {
    vi.useFakeTimers();
    t = setupTest();
  });

  afterEach(async () => {
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    vi.useRealTimers();
  });

  test("deleteDebugFilesForInactiveChats only deletes from debugChatApiRequestLog and referenced storage", async () => {
    // Create a chat
    const chatId = await t.run(async (ctx) => {
      return await ctx.db.insert("chats", {
        creatorId: await ctx.db.insert("sessions", {}),
        initialId: "test-chat",
        timestamp: new Date().toISOString(),
      });
    });

    // Create a storage file
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["test content"]));
    });

    // Create a chatMessagesStorageState
    const storageStateId = await t.run(async (ctx) => {
      return await ctx.db.insert("chatMessagesStorageState", {
        chatId,
        storageId,
        lastMessageRank: 1,
        partIndex: 0,
      });
    });

    // Create a debug log entry
    const logId = await t.run(async (ctx) => {
      return await ctx.db.insert("debugChatApiRequestLog", {
        chatId,
        responseCoreMessages: [],
        promptCoreMessagesStorageId: storageId,
        finishReason: "stop",
        modelId: "test-model",
        usage: {
          completionTokens: 0,
          promptTokens: 0,
          cachedPromptTokens: 0,
        },
        chefTokens: 0,
      });
    });

    // Advance time by a second
    vi.advanceTimersByTime(1000);

    // Run the cleanup function
    await t.mutation(internal.cleanup.deleteDebugFilesForInactiveChats, {
      forReal: true,
      shouldScheduleNext: false,
      ageInDays: 0,
    });

    // Verify the debug log entry was deleted
    const logEntry = await t.run(async (ctx) => {
      return await ctx.db.get(logId);
    });
    expect(logEntry).toBeNull();

    // Verify the storage file was deleted
    const storageFile = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(storageId);
    });
    expect(storageFile).toBeNull();

    // Verify the chat and storage state were NOT deleted
    const chat = await t.run(async (ctx) => {
      return await ctx.db.get(chatId);
    });
    expect(chat).not.toBeNull();

    const storageState = await t.run(async (ctx) => {
      return await ctx.db.get(storageStateId);
    });
    expect(storageState).not.toBeNull();
  });
});
