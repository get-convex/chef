import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { OpenAI } from "openai";
import { internal } from "./_generated/api";

export const firstMessage = internalAction({
  args: { chatId: v.id("chatMessagesStorageState"), message: v.string(), subchatIndex: v.number() },
  handler: async (ctx, args) => {
    const { chatId, message, subchatIndex } = args;
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that summarizes users prompts into 4 words or less. These summaries should be a short description of the feautre/bug a user is trying to work on.",
        },
        { role: "user", content: message },
      ],
    });
    if (!response.choices[0].message.content) {
      throw new Error("Failed to summarize message");
    }
    const summary = response.choices[0].message.content;
    await ctx.runMutation(internal.summarize.saveMessageSummary, {
      chatId,
      subchatIndex,
      summary,
    });
  },
});

export const saveMessageSummary = internalMutation({
  args: { chatId: v.id("chatMessagesStorageState"), subchatIndex: v.number(), summary: v.string() },
  handler: async (ctx, args) => {
    const { chatId, subchatIndex, summary } = args;
    await ctx.db.patch(chatId, {
      description: summary,
    });
  },
});
