import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { OpenAI } from "openai";
import { internal } from "./_generated/api";

const SUMMARIZE_SYSTEM_PROMPT = `You are a helpful assistant that given a users' prompt, summarizes it into 5 words
or less. These summaries should be a short description of the feature/bug a user is trying to work on.
You should not include any punctuation in your summaries. Always capitalize the first letter of your summary
and the rest of the summary should be lowercase. Here are a few examples of good summaries:
#1
User's prompt: "Create a nice landing page for the notion clone that has a clear CTA and hero section."
Summary: "Update landing page
#2
User's prompt: "Fix bug where the slack chat won't auto-scroll to the bottom when a new message is sent."
Summary: "Fix auto-scroll bug"
#3
User's prompt: "Build a simple splitwise clone that has groups and allows users to split expenses."
Summary: "Splitwise clone"
`;

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
