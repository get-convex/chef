import { v } from "convex/values";
import { httpAction, internalMutation, mutation } from "./_generated/server";
import { getCurrentMember } from "./sessions";
import { internal } from "./_generated/api";
import { rateLimiter } from "./rateLimiter";

const MAX_RATELIMITER_WAIT = 60 * 1000;

export const resendProxy = httpAction(async (ctx, req) => {
  if (!resendProxyEnabled()) {
    return new Response(JSON.stringify("Convex Resend proxy is disabled."), { status: 400 });
  }
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const url = new URL(req.url);
  if (url.pathname != "/resend-proxy/emails") {
    return new Response(JSON.stringify("Only the /emails API is supported"), { status: 400 });
  }

  const headers = new Headers(req.headers);
  const body = await req.json();

  let recipientEmail: string;
  if (typeof body.to === "string") {
    recipientEmail = body.to;
  } else {
    if (!Array.isArray(body.to) || body.to.length !== 1) {
      return new Response(JSON.stringify("Convex Resend proxy only supports one recipient."), { status: 400 });
    }
    recipientEmail = body.to[0];
  }

  if (body.bcc || body.cc) {
    return new Response(JSON.stringify("Convex Resend proxy does not support bcc or cc."), { status: 400 });
  }

  if (body.scheduled_at) {
    return new Response(JSON.stringify("Convex Resend proxy does not support scheduled emails."), { status: 400 });
  }

  if (body.headers) {
    return new Response(JSON.stringify("Convex Resend proxy does not support custom headers."), { status: 400 });
  }

  const authHeader = headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify("Unauthorized"), { status: 401 });
  }
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify("Invalid authorization header"), { status: 401 });
  }
  const token = authHeader.slice(7);
  const result = await ctx.runMutation(internal.resendProxy.decrementToken, { token, recipientEmail });
  if (!result.success) {
    return new Response(JSON.stringify(result.error), { status: 401 });
  }

  // Wait for the rate limiter once we've passed validation.
  let waitStart = Date.now();
  let deadline = waitStart + MAX_RATELIMITER_WAIT;
  while (true) {
    const status = await rateLimiter.limit(ctx, "resendProxy");
    if (status.ok) {
      break;
    }
    const now = Date.now();
    if (now > deadline) {
      return new Response(JSON.stringify("Rate limit exceeded"), { status: 429 });
    }
    const remainingTime = deadline - now;
    const waitTime = Math.min(status.retryAfter * (1 + Math.random()), remainingTime);
    console.warn(`Rate limit exceeded, waiting ${waitTime}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  const deploymentName = process.env.CONVEX_CLOUD_URL?.replace("https://", "").replace(".convex.cloud", "");
  return await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Chef Notifications <${deploymentName}@convexchef.app>`,
      to: recipientEmail,
      subject: body.subject,
      html: body.html,
      scheduled_at: body.scheduled_at,
      reply_to: body.reply_to,
      text: body.text,
      attachments: body.attachments,
      tags: body.tags,
    }),
  });
});

export const decrementToken = internalMutation({
  args: {
    token: v.string(),
    recipientEmail: v.string(),
  },
  handler: async (ctx, args) => {
    if (!resendProxyEnabled()) {
      return { success: false, error: "Convex Resend proxy is disabled." };
    }
    const token = await ctx.db
      .query("resendTokens")
      .withIndex("byToken", (q) => q.eq("token", args.token))
      .unique();
    if (!token) {
      return { success: false, error: "Invalid RESEND_API_TOKEN" };
    }
    if (token.requestsRemaining <= 0) {
      return { success: false, error: "Resend API token has no requests remaining." };
    }
    if (token.verifiedEmail !== args.recipientEmail) {
      return {
        success: false,
        error: `The Convex Resend API Proxy only supports sending email to your own verified email address (${token.verifiedEmail}).`,
      };
    }
    await ctx.db.patch(token._id, {
      requestsRemaining: token.requestsRemaining - 1,
      lastUsedTime: Date.now(),
    });
    return { success: true };
  },
});

export const issueResendToken = mutation({
  handler: async (ctx) => {
    if (!resendProxyEnabled()) {
      return null;
    }
    const member = await getCurrentMember(ctx);
    if (!member) {
      console.error("Not authorized", member);
      return null;
    }
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      console.error("Not authorized", identity);
      return null;
    }
    if (!identity.email || !identity.emailVerified) {
      console.error("User has no email or email is not verified", identity);
      return null;
    }
    const existing = await ctx.db
      .query("resendTokens")
      .withIndex("byMemberId", (q) => q.eq("memberId", member._id))
      .unique();
    if (existing) {
      if (existing.verifiedEmail !== identity.email) {
        await ctx.db.patch(existing._id, {
          verifiedEmail: identity.email,
        });
      }
      return existing.token;
    }
    const token = crypto.randomUUID();
    await ctx.db.insert("resendTokens", {
      memberId: member._id,
      token,
      verifiedEmail: identity.email,
      requestsRemaining: includedRequests(),
      lastUsedTime: 0,
    });
    return token;
  },
});

function resendProxyEnabled() {
  const fromEnv = process.env.RESEND_PROXY_ENABLED;
  return fromEnv && fromEnv == "1";
}

function includedRequests() {
  const fromEnv = process.env.RESEND_INCLUDED_REQUESTS;
  // Resend prices $0.06 for 100 emails.
  return fromEnv ? parseInt(fromEnv) : 100;
}
