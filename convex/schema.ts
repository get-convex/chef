import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import type { Infer, Validator, VAny } from "convex/values";
import type { SerializedMessage } from "./messages";
import type { CoreMessage } from "ai";

export const apiKeyValidator = v.object({
  preference: v.union(v.literal("always"), v.literal("quotaExhausted")),
  // NB: This is the *Anthropic* API key.
  value: v.optional(v.string()),
  openai: v.optional(v.string()),
  xai: v.optional(v.string()),
  google: v.optional(v.string()),
});

// A stable-enough way to store token usage.
export const usageRecordValidator = v.object({
  completionTokens: v.number(),
  promptTokens: v.number(),
  /** Included in promptTokens total! */
  cachedPromptTokens: v.number(),
});

export type UsageRecord = Infer<typeof usageRecordValidator>;

export default defineSchema({
  /*
   * We create a session (if it does not exist) and store the ID in local storage.
   * We only show chats for the current session, so we rely on the session ID being
   * unguessable (i.e. we should never list session IDs or return them in function
   * results).
   */
  sessions: defineTable({
    // When auth-ing with convex.dev, we'll save a `convexMembers` document and
    // reference it here.
    memberId: v.optional(v.id("convexMembers")),
  }).index("byMemberId", ["memberId"]),

  convexMembers: defineTable({
    tokenIdentifier: v.string(),
    apiKey: v.optional(apiKeyValidator),
  }).index("byTokenIdentifier", ["tokenIdentifier"]),

  /*
   * Admin status means being on the convex team on the provision host.
   * It doesn't work when using a local big brain (provision host).
   */
  convexAdmins: defineTable({
    convexMemberId: v.id("convexMembers"), // should be unique
    lastCheckedForAdminStatus: v.number(),
    wasAdmin: v.boolean(),
  }).index("byConvexMemberId", ["convexMemberId"]),

  /*
   * All chats have two IDs -- an `initialId` that is always set (UUID) and a `urlId`
   * that is more human friendly (e.g. "tic-tac-toe").
   * The `urlId` is set based on the LLM messages so is initially unset.
   * Both `initialId` and `urlId` should be unique within the creatorId, all functions
   * should accept either `initialId` or `urlId`, and when returning an identifier,
   * we should prefer `urlId` if it is set.
   */
  chats: defineTable({
    creatorId: v.id("sessions"),
    initialId: v.string(),
    urlId: v.optional(v.string()),
    description: v.optional(v.string()),
    timestamp: v.string(),
    metadata: v.optional(v.any()), // TODO migration to remove this column
    snapshotId: v.optional(v.id("_storage")),
    lastMessageRank: v.optional(v.number()),
    convexProject: v.optional(
      v.union(
        v.object({
          kind: v.literal("connected"),
          projectSlug: v.string(),
          teamSlug: v.string(),
          // for this member's dev deployment
          deploymentUrl: v.string(),
          deploymentName: v.string(),
          warningMessage: v.optional(v.string()),
        }),
        v.object({
          kind: v.literal("connecting"),
          checkConnectionJobId: v.optional(v.id("_scheduled_functions")),
        }),
        v.object({
          kind: v.literal("failed"),
          errorMessage: v.string(),
        }),
      ),
    ),
  })
    .index("byCreatorAndId", ["creatorId", "initialId"])
    .index("byCreatorAndUrlId", ["creatorId", "urlId"])
    .index("bySnapshotId", ["snapshotId"])
    .index("byInitialId", ["initialId"]),

  convexProjectCredentials: defineTable({
    projectSlug: v.string(),
    teamSlug: v.string(),
    memberId: v.optional(v.id("convexMembers")),
    projectDeployKey: v.string(),
  }).index("bySlugs", ["teamSlug", "projectSlug"]),

  chatMessages: defineTable({
    content: v.any() as VAny<SerializedMessage>,
    rank: v.number(),
    chatId: v.id("chats"),
    deletedAt: v.optional(v.number()),
  }).index("byChatId", ["chatId", "rank"]),
  chatMessagesStorageState: defineTable({
    chatId: v.id("chats"),
    storageId: v.union(v.id("_storage"), v.null()),
    lastMessageRank: v.number(),
    partIndex: v.number(),
    snapshotId: v.optional(v.id("_storage")),
  })
    .index("byChatId", ["chatId", "lastMessageRank", "partIndex"])
    .index("byStorageId", ["storageId"])
    .index("bySnapshotId", ["snapshotId"]),
  inviteCodes: defineTable({
    code: v.string(),
    sessionId: v.id("sessions"),
    lastUsedTime: v.union(v.number(), v.null()),
    issuedReason: v.string(),
    isActive: v.boolean(),
  })
    .index("byCode", ["code"])
    .index("bySessionId", ["sessionId"]),

  shares: defineTable({
    chatId: v.id("chats"),
    snapshotId: v.optional(v.id("_storage")),
    code: v.string(),

    chatHistoryId: v.optional(v.union(v.id("_storage"), v.null())),

    // Shares are created at one point in time, so this makes sure
    // people using the link don’t see newer messages.
    lastMessageRank: v.number(),
    partIndex: v.optional(v.number()),
    // The description of the chat at the time the share was created.
    description: v.optional(v.string()),
  })
    .index("byCode", ["code"])
    .index("bySnapshotId", ["snapshotId"])
    .index("byChatHistoryId", ["chatHistoryId"])
    .index("byChatId", ["chatId"]),

  memberOpenAITokens: defineTable({
    memberId: v.id("convexMembers"),
    token: v.string(),
    requestsRemaining: v.number(),
    lastUsedTime: v.union(v.number(), v.null()),
  })
    .index("byMemberId", ["memberId"])
    .index("byToken", ["token"]),

  resendTokens: defineTable({
    memberId: v.id("convexMembers"),
    token: v.string(),
    verifiedEmail: v.string(),
    requestsRemaining: v.number(),
    lastUsedTime: v.union(v.number(), v.null()),
  })
    .index("byMemberId", ["memberId"])
    .index("byToken", ["token"]),

  /*
   * The entire prompt sent to a LLM and the response we received.
   * Associated with an initialChatId but does not reset on rewind
   * and is not duplicated in a "share" (fork) to a new account.
   * This is roughly equivalent to what Braintrust logs would provide.
   * https://www.braintrust.dev/docs/guides/logs
   *
   * This is not designed to be load-bearing data, it is just for debugging.
   * Do not use this table to power non-debug UI or make agent decisions,
   * it may be missing or incomplete for any given chat.
   */
  debugChatApiRequestLog: defineTable({
    chatId: v.id("chats"),
    // Such a loose type doesn't feel so bad since this is debugging data, but if we try
    // to display older versions of this we need to make any fields added to CoreMessage in
    // later versions of the Vercel AI SDK optional on the read path.
    responseCoreMessages: v.array(v.any() as Validator<CoreMessage, "required", any>),
    promptCoreMessagesStorageId: v.id("_storage"),
    finishReason: v.string(),
    modelId: v.string(),
    // Not necessarily billed because personal API key use shows up here too
    billableUsage: usageRecordValidator,
    unbillableUsage: usageRecordValidator,
    billableChefTokens: v.number(),
    unbillableChefTokens: v.number(),
  }).index("byChatId", ["chatId"]),
});
