import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { initializeChat, setupTest, type TestConvex } from "./test.setup";

async function createChatId(t: TestConvex) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("chats", {
      creatorId: await ctx.db.insert("sessions", {}),
      initialId: "test-chat",
      timestamp: new Date().toISOString(),
      lastSubchatIndex: 0,
    });
  });
}

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
    const chatId = await createChatId(t);

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
        subchatIndex: 0,
      });
    });

    // Create a debug log entry
    const logId = await t.run(async (ctx) => {
      return await ctx.db.insert("debugChatApiRequestLog", {
        chatId,
        subchatIndex: 0,
        responseCoreMessages: [],
        promptCoreMessagesStorageId: storageId,
        finishReason: "stop",
        modelId: "test-model",
        usage: {
          outputTokens: 0,
          inputTokens: 0,
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

describe("deleteOldStorageStatesForLastMessageRank", () => {
  let t: TestConvex;
  beforeEach(async () => {
    vi.useFakeTimers();
    t = setupTest();
  });

  afterEach(async () => {
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    vi.useRealTimers();
  });

  test("deletes all storage states except the latest one", async () => {
    // Create a chat
    const chatId = await createChatId(t);

    // Create multiple storage states for the same lastMessageRank
    const storageStates = await t.run(async (ctx) => {
      const states = [];
      for (let i = 0; i < 3; i++) {
        const storageId = await ctx.storage.store(new Blob([`content-${i}`]));
        const snapshotId = await ctx.storage.store(new Blob([`snapshot-${i}`]));
        const state = await ctx.db.insert("chatMessagesStorageState", {
          chatId,
          storageId,
          lastMessageRank: 1,
          partIndex: i,
          subchatIndex: 0,
          snapshotId,
        });
        states.push({ state, storageId, snapshotId });
      }
      return states;
    });

    // Run the cleanup function
    await t.mutation(internal.cleanup.deleteOldStorageStatesForLastMessageRank, {
      chatId,
      lastMessageRank: 1,
      forReal: true,
    });

    // Verify only the latest storage state remains
    const remainingStates = await t.run(async (ctx) => {
      return await ctx.db
        .query("chatMessagesStorageState")
        .withIndex("byChatId", (q) => q.eq("chatId", chatId))
        .collect();
    });
    expect(remainingStates.length).toBe(1);
    expect(remainingStates[0].partIndex).toBe(2); // Latest part index

    // Delete the orphaned files
    await t.mutation(internal.cleanup.deleteOrphanedFiles, {
      forReal: true,
      shouldScheduleNext: true,
    });

    // Verify the snapshot is still there
    const snapshotFile = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(remainingStates[0].snapshotId!);
    });
    expect(snapshotFile).not.toBeNull();

    // Verify old storage files are deleted
    await t.run(async (ctx) => {
      for (let i = 0; i < storageStates.length - 1; i++) {
        const { state, storageId, snapshotId } = storageStates[i];
        const storageState = await ctx.db.get(state);
        expect(storageState).toBeNull();
        const storageFile = await ctx.storage.getUrl(storageId!);
        expect(storageFile).toBeNull();
        const snapshotFile = await ctx.storage.getUrl(snapshotId!);
        expect(snapshotFile).toBeNull();
      }
    });
  });

  test("does not delete snapshots that are referenced in other storage states", async () => {
    // Create a chat
    const chatId = await createChatId(t);
    // Create a snapshot
    const snapshotId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["content"]));
    });
    const snapshotId2 = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob([`snapshot-2`]));
    });
    const snapshotId3 = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob([`snapshot-3`]));
    });

    // Create multiple storage states for the different lastMessageRanks

    await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob([`content`]));
      await ctx.db.insert("chatMessagesStorageState", {
        chatId,
        storageId,
        lastMessageRank: 1,
        partIndex: 0,
        subchatIndex: 0,
        snapshotId,
      });
      await ctx.db.insert("chatMessagesStorageState", {
        chatId,
        storageId,
        lastMessageRank: 1,
        partIndex: 1,
        subchatIndex: 0,
        snapshotId: snapshotId2,
      });

      await ctx.db.insert("chatMessagesStorageState", {
        chatId,
        storageId,
        lastMessageRank: 2,
        partIndex: 0,
        subchatIndex: 0,
        snapshotId: snapshotId2,
      });
      await ctx.db.insert("chatMessagesStorageState", {
        chatId,
        storageId: null,
        lastMessageRank: 2,
        partIndex: 0,
        subchatIndex: 0,
        snapshotId: snapshotId3,
      });
    });

    await t.mutation(internal.cleanup.deleteOldStorageStatesForLastMessageRank, {
      chatId,
      lastMessageRank: 1,
      forReal: true,
    });
    await t.mutation(internal.cleanup.deleteOldStorageStatesForLastMessageRank, {
      chatId,
      lastMessageRank: 2,
      forReal: true,
    });

    // Delete the orphaned files
    await t.mutation(internal.cleanup.deleteOrphanedFiles, {
      forReal: true,
      shouldScheduleNext: true,
    });

    // Verify the first snapshot is not there
    const snapshotFile = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(snapshotId);
    });
    expect(snapshotFile).toBeNull();
    // Verify the second snapshot is still there
    const snapshotFile2 = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(snapshotId2);
    });
    expect(snapshotFile2).not.toBeNull();
    // Verify the third snapshot is still there
    const snapshotFile3 = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(snapshotId3);
    });
    expect(snapshotFile3).not.toBeNull();
  });

  test("does not delete snapshots that are used by the latest storage state", async () => {
    // Create a chat
    const chatId = await createChatId(t);

    // Create a snapshot
    const snapshotId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["content"]));
    });

    // Create multiple storage states for the same lastMessageRank
    await t.run(async (ctx) => {
      const states = [];
      for (let i = 0; i < 3; i++) {
        const storageId = await ctx.storage.store(new Blob([`content-${i}`]));
        const state = await ctx.db.insert("chatMessagesStorageState", {
          chatId,
          storageId,
          lastMessageRank: 1,
          partIndex: i,
          subchatIndex: 0,
          snapshotId,
        });
        states.push({ state, storageId, snapshotId });
      }
      return states;
    });

    await t.mutation(internal.cleanup.deleteOldStorageStatesForLastMessageRank, {
      chatId,
      lastMessageRank: 1,
      forReal: true,
    });

    const remainingStates = await t.run(async (ctx) => {
      return await ctx.db
        .query("chatMessagesStorageState")
        .withIndex("byChatId", (q) => q.eq("chatId", chatId))
        .collect();
    });
    expect(remainingStates.length).toBe(1);
    expect(remainingStates[0].partIndex).toBe(2); // Latest part index
    // Verify the snapshot is still there
    const snapshotFile = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(remainingStates[0].snapshotId!);
    });
    expect(snapshotFile).not.toBeNull();
  });

  test("does nothing when there is only one storage state", async () => {
    // Create a chat
    const chatId = await createChatId(t);

    // Create a single storage state
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["content"]));
    });
    const snapshotId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["snapshot"]));
    });
    const stateId = await t.run(async (ctx) => {
      return await ctx.db.insert("chatMessagesStorageState", {
        chatId,
        storageId,
        lastMessageRank: 1,
        partIndex: 0,
        subchatIndex: 0,
        snapshotId,
      });
    });

    // Run the cleanup function
    await t.mutation(internal.cleanup.deleteOldStorageStatesForLastMessageRank, {
      chatId,
      lastMessageRank: 1,
      forReal: true,
    });

    // Verify the storage state still exists
    const state = await t.run(async (ctx) => {
      return await ctx.db.get(stateId);
    });
    expect(state).not.toBeNull();

    // Verify the storage file still exists
    const storageFile = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(storageId);
    });
    expect(storageFile).not.toBeNull();

    // Verify the snapshot file still exists
    const snapshotFile = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(snapshotId);
    });
    expect(snapshotFile).not.toBeNull();
  });

  test("dry run does not delete anything", async () => {
    // Create a chat
    const chatId = await createChatId(t);

    // Create multiple storage states
    const storageStates = await t.run(async (ctx) => {
      const states = [];
      for (let i = 0; i < 3; i++) {
        const storageId = await ctx.storage.store(new Blob([`content-${i}`]));
        const snapshotId = await ctx.storage.store(new Blob([`snapshot-${i}`]));
        const state = await ctx.db.insert("chatMessagesStorageState", {
          chatId,
          storageId,
          lastMessageRank: 1,
          partIndex: i,
          subchatIndex: 0,
          snapshotId,
        });
        states.push(state);
      }
      return states;
    });

    // Run the cleanup function with dry run
    await t.mutation(internal.cleanup.deleteOldStorageStatesForLastMessageRank, {
      chatId,
      lastMessageRank: 1,
      forReal: false,
    });

    // Verify all storage states still exist
    const remainingStates = await t.run(async (ctx) => {
      return await ctx.db
        .query("chatMessagesStorageState")
        .withIndex("byChatId", (q) => q.eq("chatId", chatId))
        .collect();
    });
    expect(remainingStates.length).toBe(3);

    // Verify all storage files still exist
    const storageFiles = await t.run(async (ctx) => {
      const files = [];
      for (const state of storageStates) {
        const storageState = await ctx.db.get(state);
        if (storageState) {
          const storageFile = await ctx.storage.getUrl(storageState.storageId!);
          const snapshotFile = await ctx.storage.getUrl(storageState.snapshotId!);
          files.push({ storageFile, snapshotFile });
        }
      }
      return files;
    });

    // All storage and snapshot files should still exist
    for (const file of storageFiles) {
      expect(file.storageFile).not.toBeNull();
      expect(file.snapshotFile).not.toBeNull();
    }
  });
});

describe("file cleanup tests", () => {
  let t: TestConvex;
  beforeEach(async () => {
    vi.useFakeTimers();
    t = setupTest();
  });

  afterEach(async () => {
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    vi.useRealTimers();
  });
  test("deletes file when not referenced anywhere", async () => {
    // Create a storage file
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["test content"]));
    });

    // Run the cleanup function
    const result = await t.run(async (ctx) => {
      return await ctx.db.system.get(storageId);
    });
    expect(result).not.toBeNull();

    await t.mutation(internal.cleanup.deleteOrphanedFiles, {
      forReal: true,
      shouldScheduleNext: false,
    });

    // Verify the file was deleted
    const storageFile = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(storageId);
    });
    expect(storageFile).toBeNull();
  });

  test("does not delete file when referenced by chat", async () => {
    // Create a storage file
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["test content"]));
    });

    // Create a chat that references the storage file
    await t.run(async (ctx) => {
      await ctx.db.insert("chats", {
        creatorId: await ctx.db.insert("sessions", {}),
        initialId: "test-chat",
        timestamp: new Date().toISOString(),
        lastSubchatIndex: 0,
        snapshotId: storageId,
      });
    });

    // Run the cleanup function
    await t.mutation(internal.cleanup.deleteOrphanedFiles, {
      forReal: true,
      shouldScheduleNext: false,
    });

    // Verify the file was not deleted
    const storageFile = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(storageId);
    });
    expect(storageFile).not.toBeNull();
  });

  test("does not delete file when referenced by chatMessagesStorageState as snapshotId", async () => {
    // Create a storage file
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["test content"]));
    });

    // Create a chat and storage state that references the storage file
    const chatId = await createChatId(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("chatMessagesStorageState", {
        chatId,
        storageId: null,
        lastMessageRank: 1,
        partIndex: 0,
        subchatIndex: 0,
        snapshotId: storageId,
      });
    });

    // Run the cleanup function
    await t.mutation(internal.cleanup.deleteOrphanedFiles, {
      forReal: true,
      shouldScheduleNext: false,
    });

    // Verify the file was not deleted
    const storageFile = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(storageId);
    });
    expect(storageFile).not.toBeNull();
  });

  test("does not delete file when referenced by chatMessagesStorageState as storageId", async () => {
    // Create a storage file
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["test content"]));
    });
    // Create a chat and storage state that references the storage file
    const chatId = await createChatId(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("chatMessagesStorageState", {
        chatId,
        storageId,
        lastMessageRank: 1,
        partIndex: 0,
        subchatIndex: 0,
      });
    });
    // Run the cleanup function
    await t.mutation(internal.cleanup.deleteOrphanedFiles, {
      forReal: true,
      shouldScheduleNext: false,
    });
    // Verify the file was not deleted
    const storageFile = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(storageId);
    });
    expect(storageFile).not.toBeNull();
  });

  test("does not delete files when referenced by share", async () => {
    const { sessionId, chatId } = await initializeChat(t);
    await t.mutation(api.share.create, { sessionId, id: chatId });
    await t.run(async (ctx) => {
      for (const doc of await ctx.db.query("chatMessagesStorageState").collect()) {
        await ctx.db.delete(doc._id);
      }
    });

    // Run the cleanup function
    await t.mutation(internal.cleanup.deleteOrphanedFiles, {
      forReal: true,
      shouldScheduleNext: false,
    });

    const files = await t.run(async (ctx) => await ctx.db.system.query("_storage").collect());
    expect(files.length).toBe(2);
  });

  test("does not delete file when referenced by socialShare", async () => {
    // Create a storage file
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["test content"]));
    });

    // Create a social share that references the storage file
    const chatId = await createChatId(t);
    const socialShareId = await t.mutation(internal.socialShare.createAdminShare, {
      chatId,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(socialShareId, {
        thumbnailImageStorageId: storageId,
      });
    });

    // Run the cleanup function
    await t.mutation(internal.cleanup.deleteOrphanedFiles, {
      forReal: true,
      shouldScheduleNext: false,
    });

    // Verify the file was not deleted
    const storageFile = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(storageId);
    });
    expect(storageFile).not.toBeNull();
  });

  test("does not delete file when referenced by debugChatApiRequestLog", async () => {
    // Create a storage file
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["test content"]));
    });

    // Create a debug log that references the storage file
    const chatId = await createChatId(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("debugChatApiRequestLog", {
        chatId,
        subchatIndex: 0,
        responseCoreMessages: [],
        promptCoreMessagesStorageId: storageId,
        finishReason: "stop",
        modelId: "test-model",
        usage: {
          outputTokens: 0,
          inputTokens: 0,
          cachedPromptTokens: 0,
        },
        chefTokens: 0,
      });
    });

    // Run the cleanup function
    await t.mutation(internal.cleanup.deleteOrphanedFiles, {
      forReal: true,
      shouldScheduleNext: false,
    });

    // Verify the file was not deleted
    const storageFile = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(storageId);
    });
    expect(storageFile).not.toBeNull();
  });

  test("dry run does not delete file", async () => {
    // Create a storage file
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["test content"]));
    });

    // Run the cleanup function with dry run
    await t.mutation(internal.cleanup.deleteOrphanedFiles, {
      forReal: false,
      shouldScheduleNext: false,
    });

    // Verify the file was not deleted
    const storageFile = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(storageId);
    });
    expect(storageFile).not.toBeNull();
  });
});
