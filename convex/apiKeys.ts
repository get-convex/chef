import { ConvexError, v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { apiKeyValidator } from "./schema";
import { getMemberByConvexMemberIdQuery } from "./sessions";

export const apiKeyForCurrentMember = query({
  args: {},
  returns: v.union(v.null(), apiKeyValidator),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const existingMember = await getMemberByConvexMemberIdQuery(ctx, identity).first();

    return existingMember?.apiKey;
  },
});

export const setApiKeyForCurrentMember = mutation({
  args: {
    apiKey: apiKeyValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }

    const existingMember = await getMemberByConvexMemberIdQuery(ctx, identity).first();

    if (!existingMember) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }

    await ctx.db.patch(existingMember._id, { apiKey: args.apiKey });
  },
});

export const deleteApiKeyForCurrentMember = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }

    const existingMember = await getMemberByConvexMemberIdQuery(ctx, identity).first();

    if (!existingMember) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }

    await ctx.db.patch(existingMember._id, { apiKey: undefined });
  },
});

export const deleteAnthropicApiKeyForCurrentMember = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }

    const existingMember = await getMemberByConvexMemberIdQuery(ctx, identity).first();

    if (!existingMember) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }
    if (!existingMember.apiKey) {
      return;
    }
    await ctx.db.patch(existingMember._id, {
      apiKey: {
        ...existingMember.apiKey,
        value: undefined,
      },
    });
  },
});

export const deleteOpenaiApiKeyForCurrentMember = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }

    const existingMember = await getMemberByConvexMemberIdQuery(ctx, identity).first();

    if (!existingMember) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }
    if (!existingMember.apiKey) {
      return;
    }
    await ctx.db.patch(existingMember._id, {
      apiKey: {
        ...existingMember.apiKey,
        openai: undefined,
      },
    });
  },
});

export const deleteXaiApiKeyForCurrentMember = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }

    const existingMember = await getMemberByConvexMemberIdQuery(ctx, identity).first();

    if (!existingMember) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }
    if (!existingMember.apiKey) {
      return;
    }
    await ctx.db.patch(existingMember._id, {
      apiKey: {
        ...existingMember.apiKey,
        xai: undefined,
      },
    });
  },
});

export const deleteGoogleApiKeyForCurrentMember = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }

    const existingMember = await getMemberByConvexMemberIdQuery(ctx, identity).first();

    if (!existingMember) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }
    if (!existingMember.apiKey) {
      return;
    }
    await ctx.db.patch(existingMember._id, {
      apiKey: {
        ...existingMember.apiKey,
        google: undefined,
      },
    });
  },
});

export const validateAnthropicApiKey = action({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": args.apiKey,
      },
    });

    if (response.status === 401) {
      return false;
    }
    return true;
  },
});

export const validateOpenaiApiKey = action({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.apiKey}`,
      },
    });

    if (response.status === 401) {
      return false;
    }
    return true;
  },
});

export const validateGoogleApiKey = action({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${args.apiKey}`);

    if (response.status === 400) {
      return false;
    }
    return true;
  },
});

export const validateXaiApiKey = action({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }

    const response = await fetch("https://api.x.ai/v1/models", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.apiKey}`,
      },
    });
    if (response.status === 400) {
      return false;
    }
    return true;
  },
});
