import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import type { Infer, Validator } from "convex/values";
import type { CoreMessage } from "ai";

export const apiKeyValidator = v.object({
  preference: v.union(v.literal("always"), v.literal("quotaExhausted")),
  // NB: This is the *Anthropic* API key.
  value: v.optional(v.string()),
  openai: v.optional(v.string()),
  xai: v.optional(v.string()),
  google: v.optional(v.string()),
  openrouter: v.optional(v.string()),
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
    convexMemberId: v.optional(v.string()),
    softDeletedForWorkOSMerge: v.optional(v.boolean()),
    // Not authoritative, just a cache of the user's profile from WorkOS/provision host.
    cachedProfile: v.optional(
      v.object({
        username: v.string(),
        avatar: v.string(),
        email: v.string(),
        id: v.string(),
      }),
    ),
  })
    .index("byTokenIdentifier", ["tokenIdentifier"])
    .index("byConvexMemberId", ["convexMemberId", "softDeletedForWorkOSMerge"]),

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
    lastSubchatIndex: v.number(),
    hasBeenDeployed: v.optional(v.boolean()),
    isDeleted: v.optional(v.boolean()),
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
    .index("byCreatorAndId", ["creatorId", "initialId", "isDeleted"])
    .index("byCreatorAndUrlId", ["creatorId", "urlId", "isDeleted"])
    .index("bySnapshotId", ["snapshotId"])
    .index("byInitialId", ["initialId", "isDeleted"]),

  convexProjectCredentials: defineTable({
    projectSlug: v.string(),
    teamSlug: v.string(),
    memberId: v.optional(v.id("convexMembers")),
    projectDeployKey: v.string(),
  }).index("bySlugs", ["teamSlug", "projectSlug"]),
  chatMessagesStorageState: defineTable({
    chatId: v.id("chats"),
    storageId: v.union(v.id("_storage"), v.null()),
    subchatIndex: v.number(),
    lastMessageRank: v.number(),
    description: v.optional(v.string()),
    partIndex: v.number(),
    snapshotId: v.optional(v.id("_storage")),
  })
    .index("byChatId", ["chatId", "subchatIndex", "lastMessageRank", "partIndex"])
    .index("byStorageId", ["storageId"])
    .index("bySnapshotId", ["snapshotId"]),

  // This type of share is for forking from a specific point in time.
  // Call it a debugging snapshot or a fork point. There can be multiple per chat.
  // The main thing they are used for is forking a project at a set point
  // into another user's account.
  shares: defineTable({
    chatId: v.id("chats"),
    snapshotId: v.id("_storage"),
    code: v.string(),

    chatHistoryId: v.union(v.id("_storage"), v.null()),

    // Keeps track of the lastMessageRank, partIndex, and subchatIndex of the chat at the time the share was created.
    // These fields aren't used but they are useful hints for how big the chat is and where the snapshot came from.
    lastMessageRank: v.number(),
    lastSubchatIndex: v.number(),
    partIndex: v.optional(v.number()),
    // The description of the chat at the time the share was created.
    description: v.optional(v.string()),
  })
    .index("byCode", ["code"])
    .index("bySnapshotId", ["snapshotId"])
    .index("byChatHistoryId", ["chatHistoryId"])
    .index("byChatIdAndLastSubchatIndex", ["chatId", "lastSubchatIndex"]),

  // This type of share is for sharing a "project."
  // You only get one for a given project for now.
  socialShares: defineTable({
    chatId: v.id("chats"),
    code: v.string(),
    thumbnailImageStorageId: v.optional(v.id("_storage")),
    // Does the share link work. Three states so we can immediately share on opening the share dialog.
    shared: v.union(v.literal("shared"), v.literal("expresslyUnshared"), v.literal("noPreferenceExpressed")),
    // Allow others to fork this project at its most recent state. Always true for now.
    allowForkFromLatest: v.boolean(),
    // Allow to be shown in gallery (doesn't mean we actual show it).
    // Always false for now, this doesn't exist yet.
    allowShowInGallery: v.boolean(),
    // Link to the deployed version from the share card. Always true for now.
    linkToDeployed: v.boolean(),
    // Optional referral code for Convex signup bonus
    referralCode: v.optional(v.union(v.string(), v.null())),
  })
    .index("byCode", ["code"])
    .index("byChatId", ["chatId"])
    .index("byAllowShowInGallery", ["allowShowInGallery"])
    .index("byThumbnailImageStorageId", ["thumbnailImageStorageId"]),

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
    subchatIndex: v.optional(v.number()),
    // Such a loose type doesn't feel so bad since this is debugging data, but if we try
    // to display older versions of this we need to make any fields added to CoreMessage in
    // later versions of the Vercel AI SDK optional on the read path.
    responseCoreMessages: v.array(v.any() as Validator<CoreMessage, "required", any>),
    promptCoreMessagesStorageId: v.id("_storage"),
    finishReason: v.string(),
    modelId: v.string(),

    // Not necessarily the usage we billed because
    // - personal API key use shows up here too
    // - failed tool calls count here but we try not to bill for those
    // - usage code uses the provider for the final generation to bill for all LLM calls in the same interation
    //   but this debug info uses the correct provider for each call
    usage: usageRecordValidator,
    chefTokens: v.number(),
  })
    .index("byChatId", ["chatId"])
    .index("byStorageId", ["promptCoreMessagesStorageId"]),
  // Inspired by the migrations component, but for our migrations that we don't use the component for.
  migrations: defineTable({
    name: v.string(),
    forReal: v.boolean(),
    cursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
    // The number of documents processed so far.
    processed: v.number(),
    numDeleted: v.number(),
    latestEnd: v.optional(v.number()),
  })
    .index("name", ["name"])
    .index("isDone", ["isDone"]),
});
