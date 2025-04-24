import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { assertIsConvexAdmin } from "./admin";
import type { Id } from "./_generated/dataModel";
import { usageRecordValidator } from "./schema";

async function getChatByInitialId(ctx: QueryCtx, initialId: string) {
  const chatByInitialId = await ctx.db
    .query("chats")
    .withIndex("byInitialId", (q: any) => q.eq("initialId", initialId))
    .unique();
  if (!chatByInitialId) {
    throw new Error(`No corresponding chat found for initial ID ${initialId}`);
  }
  return chatByInitialId;
}

export const storeDebugPrompt = internalMutation({
  args: {
    chatInitialId: v.string(),
    responseCoreMessages: v.array(v.any()),
    promptCoreMessagesStorageId: v.id("_storage"),
    finishReason: v.string(),
    modelId: v.optional(v.string()),
    billableUsage: usageRecordValidator,
    unbillableUsage: usageRecordValidator,
    billableChefTokens: v.number(),
    unbillableChefTokens: v.number(),
  },
  handler: async (ctx, args) => {
    const {
      chatInitialId,
      responseCoreMessages,
      promptCoreMessagesStorageId,
      finishReason,
      modelId,
      billableUsage,
      unbillableUsage,
      billableChefTokens,
      unbillableChefTokens,
    } = args;
    const chat = await getChatByInitialId(ctx, chatInitialId);
    await ctx.db.insert("debugChatApiRequestLog", {
      chatId: chat._id,
      responseCoreMessages,
      promptCoreMessagesStorageId,
      finishReason,
      modelId: modelId ?? "",
      billableUsage,
      unbillableUsage,
      billableChefTokens,
      unbillableChefTokens,
    });
  },
});

export const deleteDebugPrompt = internalMutation({
  args: {
    id: v.id("debugChatApiRequestLog"),
  },
  handler: async (ctx, args) => {
    await _deleteDebugPrompt(ctx, args.id);
  },
});

async function _deleteDebugPrompt(ctx: MutationCtx, id: Id<"debugChatApiRequestLog">) {
  const record = await ctx.db.get(id);
  if (!record) {
    return;
  }
  await ctx.storage.delete(record.promptCoreMessagesStorageId);
  await ctx.db.delete(id);
}

// this is going to fail on big tables, we'll need to use an action
export const deleteAllDebugPrompts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("debugChatApiRequestLog").collect();

    for (let i = 0; i < records.length; i += 10) {
      const chunk = records.slice(i, i + 10);
      await Promise.all(chunk.map((record) => _deleteDebugPrompt(ctx, record._id)));
    }
  },
});

export const show = query({
  args: {
    chatInitialId: v.string(),
  },
  handler: async (ctx, args) => {
    await assertIsConvexAdmin(ctx);

    const chat = await getChatByInitialId(ctx, args.chatInitialId);

    const debugPrompts = await ctx.db
      .query("debugChatApiRequestLog")
      .withIndex("byChatId", (q) => q.eq("chatId", chat._id))
      .collect();

    const promptsWithUrls = await Promise.all(
      debugPrompts.map(async (prompt) => ({
        ...prompt,
        coreMessagesUrl: await ctx.storage.getUrl(prompt.promptCoreMessagesStorageId),
      })),
    );

    return promptsWithUrls;
  },
});
