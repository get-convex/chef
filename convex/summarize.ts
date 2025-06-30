import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { OpenAI } from "openai";
import { internal } from "./_generated/api";

const SUMMARIZE_SYSTEM_PROMPT = `You are a helpful assistant that summarizes users prompts into 5 words
or less. These summaries should be a short description of the feature/bug a user is trying to work on.
You should not include any punctuation in your summaries. Always capitalize the first letter of your summary.
The rest of the summary should be lowercase.`;

export const firstMessage = internalAction({
  args: { chatMessageId: v.id("chatMessagesStorageState"), message: v.string() },
  handler: async (ctx, args) => {
    const { chatMessageId, message } = args;
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: SUMMARIZE_SYSTEM_PROMPT,
        },
        { role: "user", content: message },
      ],
    });
    if (!response.choices[0].message.content) {
      throw new Error("Failed to summarize message");
    }
    const summary = response.choices[0].message.content;
    await ctx.runMutation(internal.summarize.saveMessageSummary, {
      chatMessageId,
      summary,
    });
  },
});

export const saveMessageSummary = internalMutation({
  args: { chatMessageId: v.id("chatMessagesStorageState"), summary: v.string() },
  handler: async (ctx, args) => {
    const { chatMessageId, summary } = args;
    await ctx.db.patch(chatMessageId, {
      description: summary,
    });
  },
});
