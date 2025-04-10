import { ConvexError, v } from "convex/values";
import { httpAction, internalMutation, mutation } from "./_generated/server";
import { getCurrentMember } from "./sessions";
import { internal } from "./_generated/api";

export const openaiProxy = httpAction(async (ctx, req) => {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not set");
    }
    const headers = new Headers(req.headers);
    const authHeader = headers.get("Authorization");
    if (!authHeader) {
        return new Response("Unauthorized", { status: 401 });
    }
    if (!authHeader.startsWith("Bearer ")) {
        return new Response("Invalid authorization header", { status: 401 });
    }
    const token = authHeader.slice(7);
    const result = await ctx.runMutation(internal.openaiProxy.decrementToken, { token });
    if (!result.success) {
        return new Response(result.error, { status: 401 });
    }

    let body: any;
    try {
        body = await req.json();
    } catch (error) {
        return new Response("Invalid request body", { status: 400 });
    }
    if (body.model != 'gpt-4o-mini') {
        return new Response("Only gpt-4o-mini is supported", { status: 400 });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
    });
    return response;
});

export const getOpenAIToken = mutation({
    handler: async (ctx) => {
        const member = await getCurrentMember(ctx);
        if (!member) {
            throw new ConvexError("Not authorized");
        }
        const existing = await ctx.db.query('memberOpenAITokens')
            .withIndex('byMemberId', (q) => q.eq('memberId', member._id))
            .unique();
        if (existing) {
            return existing.token;
        }
        const token = crypto.randomUUID();
        await ctx.db.insert('memberOpenAITokens', {
            memberId: member._id,
            token,
            requestsRemaining: REQUESTS_PER_MEMBER,
            lastUsedTime: 0,
        });
        return token;

    }
})

export const decrementToken = internalMutation({
    args: {
        token: v.string(),
    },
    handler: async (ctx, args) => {
        const token = await ctx.db.query('memberOpenAITokens')
            .withIndex('byToken', (q) => q.eq('token', args.token))
            .unique();
        if (!token) {
            return { success: false, error: "Invalid OPENAI_API_TOKEN" };
        }
        if (token.requestsRemaining <= 0) {
            return { success: false, error: "Convex OPENAI_API_TOKEN has no requests remaining. Go sign up for an OpenAI API key at https://platform.openai.com and update your app to use that." };
        }
        await ctx.db.patch(token._id, {
            requestsRemaining: token.requestsRemaining - 1,
            lastUsedTime: Date.now(),
        });
        return { success: true };
    }
})

// Cost per gpt-4o-mini request (2025-04-09):
// 16384 max output tokens @ $0.6/1M
// 128K max input tokens @ $0.15/1M
// => ~$0.03 per request.
const REQUESTS_PER_MEMBER = 100;


