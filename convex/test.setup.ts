import { convexTest, type TestConvexForDataModel } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import type { SerializedMessage } from "./messages";
import type { Id } from "./_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import { expect } from "vitest";

// TODO -- for some reason, parameterizing on the generated `DataModel` does not work
export type TestConvex = TestConvexForDataModel<any>;

// Polyfill for Web Crypto API used in storage calls
if (typeof globalThis.crypto === "undefined") {
  const { webcrypto } = await import("node:crypto");
  globalThis.crypto = webcrypto as unknown as Crypto;
}

export const modules = import.meta.glob("../convex/**/*.*s");

export function setupTest() {
  const test = convexTest(schema, modules);
  const t = test.withIdentity({ name: "Emma" });
  return t;
}

export async function createChat(t: TestConvex) {
  const sessionId = await t.mutation(api.sessions.startSession);
  const chatId = "test";
  await t.mutation(api.messages.initializeChat, {
    id: chatId,
    sessionId,
    projectInitParams: testProjectInitParams,
  });
  return { sessionId, chatId };
}

export const testProjectInitParams = {
  teamSlug: "test",
  auth0AccessToken: "test",
};

export async function storeChat(
  t: TestConvex,
  chatId: string,
  sessionId: string,
  args: {
    messages?: SerializedMessage[];
    snapshot?: Blob;
    doNotUpdateMessages?: boolean;
  },
  expectedErrorCode?: string,
): Promise<Response> {
  const formData = new FormData();
  if (args.messages && !args.doNotUpdateMessages) {
    // NB: normally, we'd lz4 compress the string, but for testing, we'll skip that
    formData.append("messages", new Blob([JSON.stringify(args.messages)]));
  }
  if (args.snapshot) {
    formData.append("snapshot", args.snapshot);
  }

  const url = new URL("/store_chat", "http://localhost:3000");
  url.searchParams.set("sessionId", sessionId);
  url.searchParams.set("chatId", chatId);
  if (args.messages) {
    url.searchParams.set("lastMessageRank", (args.messages.length - 1).toString());
    url.searchParams.set("partIndex", ((args.messages.at(-1)?.parts?.length ?? 0) - 1).toString());
  }

  const response = await t.fetch(url.pathname + url.search, {
    method: "POST",
    body: formData,
  });
  if (expectedErrorCode) {
    if (response.status !== 200) {
      const body = await response.json();
      const error = JSON.parse(body.error);
      expect(error.code).toBe(expectedErrorCode);
    }
    if (response.status === 200) {
      throw new Error("Expected failure, but got success");
    }
  } else {
    if (response.status !== 200) {
      const body = await response.json();
      throw new Error(`Failed to store chat: ${JSON.stringify(body)}`);
    }
  }
  return response;
}

export async function verifyStoredContent(t: TestConvex, storageId: Id<"_storage">, expectedContent: string) {
  await t.run(
    async (ctx: GenericMutationCtx<any> & { storage: { get: (id: Id<"_storage">) => Promise<Blob | null> } }) => {
      const blob = await ctx.storage.get(storageId);
      if (!blob) {
        throw new Error("Failed to retrieve snapshot");
      }
      const content = await blob.text();
      expect(content).toBe(expectedContent);
    },
  );
}

export async function verifyStoredMessages(
  t: TestConvex,
  storageId: Id<"_storage">,
  expectedMessages: SerializedMessage[],
) {
  await t.run(
    async (ctx: GenericMutationCtx<any> & { storage: { get: (id: Id<"_storage">) => Promise<Blob | null> } }) => {
      const blob = await ctx.storage.get(storageId);
      if (!blob) {
        throw new Error("Failed to retrieve snapshot");
      }
      const content = await blob.text();
      const messages = JSON.parse(content) as SerializedMessage[];
      expect(messages).toEqual(expectedMessages);
    },
  );
}
