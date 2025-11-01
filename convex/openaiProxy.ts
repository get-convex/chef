import { v } from "convex/values";
import { httpAction, internalMutation, mutation } from "./_generated/server";
import { getCurrentMember } from "./sessions";
import { internal } from "./_generated/api";

const ALLOWED_MODELS = ["gpt-4o-mini", "gpt-4.1-nano"];

export const openaiProxy = httpAction(async (ctx, req) => {
  if (!openaiProxyEnabled()) {
    return new Response("Convex OpenAI proxy is disabled.", { status: 400 });
  }
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

  const url = new URL(req.url);
  if (url.pathname != "/openai-proxy/chat/completions") {
    return new Response("Only the /chat/completions API is supported", { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch (_error) {
    return new Response("Invalid request body", { status: 400 });
  }
  if (!ALLOWED_MODELS.includes(body.model)) {
    return new Response("Only gpt-4o-mini and gpt-4.1-nano are supported", { status: 400 });
  }

  if (body.max_completion_tokens && body.max_completion_tokens > 16384) {
    return new Response("max_completion_tokens must be <= 16384", { status: 400 });
  }
  if (body.max_tokens && body.max_tokens > 16384) {
    return new Response("max_tokens must be <= 16384", { status: 400 });
  }
  if (body.service_tier !== undefined) {
    return new Response("service_tier is not supported", { status: 400 });
  }
  if (body.store !== undefined) {
    return new Response("store is not supported", { status: 400 });
  }
  if (body.web_search_options !== undefined) {
    return new Response("web_search_options is not supported", { status: 400 });
  }
  // Pin allowed fields from https://platform.openai.com/docs/api-reference/chat/create on 2025-04-14.
  const proxiedBody = {
    messages: body.messages,
    model: body.model,
    audio: body.audio,
    frequency_penalty: body.frequency_penalty,
    function_call: body.function_call,
    functions: body.functions,
    logit_bias: body.logit_bias,
    logprobs: body.logprobs,
    max_completion_tokens: body.max_completion_tokens,
    max_tokens: body.max_tokens,
    metadata: body.metadata,
    modalities: body.modalities,
    n: body.n,
    parallel_tool_calls: body.parallel_tool_calls,
    prediction: body.prediction,
    presence_penalty: body.presence_penalty,
    reasoning_effort: body.reasoning_effort,
    response_format: body.response_format,
    seed: body.seed,
    stop: body.stop,
    stream: body.stream,
    stream_options: body.stream_options,
    temperature: body.temperature,
    tool_choice: body.tool_choice,
    tools: body.tools,
    top_logprobs: body.top_logprobs,
    top_p: body.top_p,
    user: body.user,
  };
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(proxiedBody),
  });
  return response;
});

export const issueOpenAIToken = mutation({
  args: {},
  handler: async (ctx) => {
    if (!openaiProxyEnabled()) {
      return null;
    }
    const member = await getCurrentMember(ctx);
    if (!member) {
      console.error("Not authorized", member);
      return null;
    }
    const existing = await ctx.db
      .query("memberOpenAITokens")
      .withIndex("byMemberId", (q) => q.eq("memberId", member._id))
      .unique();
    if (existing) {
      return existing.token;
    }
    const token = crypto.randomUUID();
    await ctx.db.insert("memberOpenAITokens", {
      memberId: member._id,
      token,
      requestsRemaining: includedRequests(),
      lastUsedTime: 0,
    });
    return token;
  },
});

export const decrementToken = internalMutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    if (!openaiProxyEnabled()) {
      return { success: false, error: "Convex OpenAI proxy is disabled." };
    }
    const token = await ctx.db
      .query("memberOpenAITokens")
      .withIndex("byToken", (q) => q.eq("token", args.token))
      .unique();
    if (!token) {
      return { success: false, error: "Invalid OPENAI_API_TOKEN" };
    }
    if (token.requestsRemaining <= 0) {
      return {
        success: false,
        error:
          "Convex OPENAI_API_TOKEN has no requests remaining. Go sign up for an OpenAI API key at https://platform.openai.com and update your app to use that.",
      };
    }
    await ctx.db.patch(token._id, {
      requestsRemaining: token.requestsRemaining - 1,
      lastUsedTime: Date.now(),
    });
    return { success: true };
  },
});

// Cost per gpt-4o-mini request (2025-04-09):
// 16384 max output tokens @ $0.6/1M
// 128K max input tokens @ $0.15/1M
// => ~$0.03 per request.
//
// Cost per gpt-4.1-nano request (2025-04-14):
// output tokens: $0.40/1M
// input tokens: $0.10/1M
function includedRequests() {
  const fromEnv = process.env.OPENAI_PROXY_INCLUDED_REQUESTS;
  if (!fromEnv) {
    return 100;
  }
  return Number(fromEnv);
}

function openaiProxyEnabled() {
  const fromEnv = process.env.OPENAI_PROXY_ENABLED;
  return fromEnv && fromEnv == "1";
}
