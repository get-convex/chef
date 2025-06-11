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

  async function setupTestData() {
    // Create a chat
    const subchatIndex = 0;
    const chatId = await t.run(async (ctx) => {
      return await ctx.db.insert("chats", {
        creatorId: await ctx.db.insert("sessions", {}),
        initialId: "test-chat",
        timestamp: new Date().toISOString(),
        lastSubchatIndex: subchatIndex,
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
        subchatIndex,
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

    return { chatId, storageId, storageStateId, logId };
  }

  test("deleteDebugFilesForInactiveChats only deletes from debugChatApiRequestLog and referenced storage", async () => {
    const { chatId, storageId, storageStateId, logId } = await setupTestData();

    // Advance time by a second
    vi.advanceTimersByTime(1000);

    // Run the cleanup function
    await t.mutation(internal.cleanup.deleteDebugFilesForInactiveChats, {
      forReal: true,
      shouldScheduleNext: false,
      daysInactive: 0,
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

  test("no deletion when data is too recent", async () => {
    const { chatId, storageId, storageStateId, logId } = await setupTestData();

    // Run the cleanup function with daysInactive=1 (older than our test data)
    await t.mutation(internal.cleanup.deleteDebugFilesForInactiveChats, {
      forReal: true,
      shouldScheduleNext: true,
      daysInactive: 1,
    });

    // Verify no new jobs were scheduled
    const scheduledJobs = await t.run(async (ctx) => {
      return await ctx.db.system.query("_scheduled_functions").collect();
    });
    expect(scheduledJobs).toHaveLength(0);

    // Verify nothing was deleted
    const logEntry = await t.run(async (ctx) => {
      return await ctx.db.get(logId);
    });
    expect(logEntry).not.toBeNull();

    const storageFile = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(storageId);
    });
    expect(storageFile).not.toBeNull();

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
