import { httpRouter } from "convex/server";
import { httpAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { ConvexError } from "convex/values";
import { openaiProxy } from "./openaiProxy";
import { corsRouter } from "convex-helpers/server/cors";
import { compressMessages } from "./compressMessages";
import { resendProxy } from "./resendProxy";

const http = httpRouter();
const httpWithCors = corsRouter(http, {
  allowedHeaders: ["Content-Type", "X-Chef-Admin-Token"],
});

// This is particularly useful with CORS, where an unhandled error won't have CORS
// headers applied to it.
function httpActionWithErrorHandling(handler: (ctx: ActionCtx, request: Request) => Promise<Response>) {
  return httpAction(async (ctx, request) => {
    try {
      return await handler(ctx, request);
    } catch (e) {
      console.error(e);
      return new Response(
        JSON.stringify({ error: e instanceof ConvexError ? e.message : "An unknown error occurred" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
  });
}
httpWithCors.route({
  path: "/upload_snapshot",
  method: "POST",
  handler: httpActionWithErrorHandling(async (ctx, request) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      throw new ConvexError("sessionId is required");
    }
    const chatId = url.searchParams.get("chatId");
    if (!chatId) {
      throw new ConvexError("chatId is required");
    }

    const blob = await request.blob();
    const storageId = await ctx.storage.store(blob);

    await ctx.runMutation(internal.snapshot.saveSnapshot, {
      sessionId: sessionId as Id<"sessions">,
      chatId: chatId as Id<"chats">,
      storageId,
    });

    return new Response(JSON.stringify({ snapshotId: storageId }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }),
});

http.route({
  pathPrefix: "/openai-proxy/",
  method: "POST",
  handler: openaiProxy,
});

http.route({
  pathPrefix: "/resend-proxy/",
  method: "POST",
  handler: resendProxy,
});

httpWithCors.route({
  path: "/initial_messages",
  method: "POST",
  handler: httpActionWithErrorHandling(async (ctx, request) => {
    const body = await request.json();
    const sessionId = body.sessionId;
    const chatId = body.chatId;
    if (!sessionId) {
      throw new ConvexError("sessionId is required");
    }
    if (!chatId) {
      throw new ConvexError("chatId is required");
    }
    const storageInfo = await ctx.runQuery(internal.messages.getInitialMessagesStorageInfo, {
      sessionId,
      chatId,
    });
    if (storageInfo) {
      if (!storageInfo.storageId) {
        return new Response(null, {
          status: 204,
        });
      }
      const blob = await ctx.storage.get(storageInfo.storageId);
      return new Response(blob, {
        status: 200,
      });
    } else {
      const messages = await ctx.runQuery(internal.messages.getInitialMessagesInternal, {
        sessionId,
        id: chatId,
      });
      if (messages.length === 0) {
        // No content
        return new Response(null, {
          status: 204,
        });
      }
      const compressed = await compressMessages(messages);
      const blob = new Blob([compressed]);
      const storageId = await ctx.storage.store(blob);
      await ctx.runMutation(internal.messages.handleStorageStateMigration, {
        sessionId,
        chatId,
        storageId,
        lastMessageRank: messages.length - 1,
        partIndex: (messages.at(-1)?.parts?.length ?? 0) - 1,
      });

      return new Response(blob, {
        status: 200,
      });
    }
  }),
});

httpWithCors.route({
  path: "/store_messages",
  method: "POST",
  handler: httpActionWithErrorHandling(async (ctx, request) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");
    const chatId = url.searchParams.get("chatId");
    const lastMessageRank = url.searchParams.get("lastMessageRank");
    const partIndex = url.searchParams.get("partIndex");
    // Older pathway that sends just messages as a single blob
    const messageBlob = await request.blob();
    const storageId = await ctx.storage.store(messageBlob);
    await ctx.runMutation(internal.messages.updateStorageState, {
      sessionId: sessionId as Id<"sessions">,
      chatId: chatId as Id<"chats">,
      lastMessageRank: parseInt(lastMessageRank!),
      partIndex: parseInt(partIndex!),
      storageId,
    });
    return new Response(null, {
      status: 200,
    });
  }),
});

httpWithCors.route({
  path: "/store_chat",
  method: "POST",
  handler: httpActionWithErrorHandling(async (ctx, request) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");
    const chatId = url.searchParams.get("chatId");
    const lastMessageRank = url.searchParams.get("lastMessageRank");
    const partIndex = url.searchParams.get("partIndex");
    const formData = await request.formData();
    let messageStorageId: Id<"_storage"> | null = null;
    let snapshotStorageId: Id<"_storage"> | null = null;
    if (formData.has("messages")) {
      const messageBlob = formData.get("messages") as Blob;
      messageStorageId = await ctx.storage.store(messageBlob);
    }
    if (formData.has("snapshot")) {
      const snapshotBlob = formData.get("snapshot") as Blob;
      snapshotStorageId = await ctx.storage.store(snapshotBlob);
    }
    await ctx.runMutation(internal.messages.updateStorageState, {
      sessionId: sessionId as Id<"sessions">,
      chatId: chatId as Id<"chats">,
      lastMessageRank: parseInt(lastMessageRank!),
      partIndex: parseInt(partIndex!),
      storageId: messageStorageId,
      snapshotId: snapshotStorageId,
    });
    return new Response(null, {
      status: 200,
    });
  }),
});

http.route({
  path: "/__debug/download_messages",
  method: "OPTIONS",
  handler: httpActionWithErrorHandling(async (ctx, request) => {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": request.headers.get("Origin") ?? "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
      },
    });
  }),
});

http.route({
  path: "/__debug/download_messages",
  method: "POST",
  handler: httpActionWithErrorHandling(async (ctx, request) => {
    const body = await request.json();
    const header = request.headers.get("X-Chef-Admin-Token");
    if (header !== process.env.CHEF_ADMIN_TOKEN) {
      return new Response(JSON.stringify({ code: "Unauthorized", message: "Invalid admin token" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
    const chatUuid = body.chatUuid;
    const storageId = await ctx.runQuery(internal.messages.getMessagesByChatInitialIdBypassingAccessControl, {
      id: chatUuid,
    });
    if (!storageId) {
      return new Response(null, {
        status: 204,
      });
    }
    const blob = await ctx.storage.get(storageId);
    return new Response(blob, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": request.headers.get("Origin") ?? "*",
        Vary: "Origin",
      },
    });
  }),
});

httpWithCors.route({
  path: "/upload_debug_prompt",
  method: "POST",
  handler: httpActionWithErrorHandling(async (ctx, request) => {
    const formData = await request.formData();
    const metadataStr = formData.get("metadata");
    const messagesBlob = formData.get("promptCoreMessages") as Blob;

    if (!metadataStr || !messagesBlob) {
      throw new ConvexError("metadata and messages are required in form data");
    }

    let metadata;
    try {
      metadata = JSON.parse(metadataStr as string);
    } catch (_e) {
      throw new ConvexError("Invalid metadata: must be valid JSON");
    }

    const promptCoreMessagesStorageId = await ctx.storage.store(messagesBlob);
    try {
      await ctx.runMutation(internal.debugPrompt.storeDebugPrompt, { ...metadata, promptCoreMessagesStorageId });
    } catch (e) {
      await ctx.storage.delete(promptCoreMessagesStorageId);
      throw e;
    }

    return new Response(JSON.stringify({ promptCoreMessagesStorageId }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }),
});

export default httpWithCors.http;
