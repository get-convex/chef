import { test } from "vitest";
import { api, internal } from "./_generated/api";
import { createChat, setupTest, storeChat, verifyStoredContent } from "./test.setup";
import type { SerializedMessage } from "./messages";

test("referenced snapshots are not deleted", async () => {
  const t = setupTest();
  const { sessionId, chatId } = await createChat(t);
  const messages: SerializedMessage[] = [
    { id: "1", role: "user", parts: [{ text: "Hello, world!", type: "text" }], createdAt: Date.now() },
  ];
  await storeChat(t, chatId, sessionId, {
    messages,
    snapshot: new Blob(["Hello, world!"]),
  });

  const { code } = await t.mutation(api.share.create, { sessionId, id: chatId });
  await storeChat(t, chatId, sessionId, {
    messages,
    snapshot: new Blob(["foobar"]),
  });

  // `storageId1` should not be deleted because it is referenced by the share
  const shareSnapshotId = await t.run(async (ctx) => {
    const share = await ctx.db
      .query("shares")
      .withIndex("byCode", (q) => q.eq("code", code))
      .first();
    if (!share) {
      throw new Error("Share not found");
    }
    if (!share.snapshotId) {
      throw new Error("Share has no snapshot");
    }
    return share.snapshotId;
  });
  await verifyStoredContent(t, shareSnapshotId, "Hello, world!");

  const storageInfo = await t.query(internal.messages.getInitialMessagesStorageInfo, {
    sessionId,
    chatId,
  });
  if (!storageInfo) {
    throw new Error("Storage info not found");
  }
  if (!storageInfo.snapshotId) {
    throw new Error("Storage info has no snapshot");
  }
  await verifyStoredContent(t, storageInfo.snapshotId, "foobar");
});
