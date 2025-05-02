import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getChatByIdOrUrlIdEnsuringAccess } from "./messages";

export const recordDeploy = mutation({
  args: {
    sessionId: v.id("sessions"),
    id: v.string(),
  },
  handler: async (ctx, { id, sessionId }) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id, sessionId });
    if (!chat) {
      throw new ConvexError("Chat not found");
    }
    await ctx.db.patch(chat._id, { hasBeenDeployed: true });
  },
});

export const hasBeenDeployed = query({
  args: {
    sessionId: v.id("sessions"),
    id: v.string(),
  },
  handler: async (ctx, { id, sessionId }) => {
    const chat = await getChatByIdOrUrlIdEnsuringAccess(ctx, { id, sessionId });
    if (!chat) {
      throw new ConvexError("Chat not found");
    }
    return !!chat.hasBeenDeployed;
  },
});
