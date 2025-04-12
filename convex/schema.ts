import { defineSchema, defineTable } from 'convex/server';
import { v, type VAny } from 'convex/values';
import type { SerializedMessage } from './messages';

export const apiKeyValidator = v.object({
  preference: v.union(v.literal('always'), v.literal('quotaExhausted')),
  // NB: This is the *Anthropic* API key.
  value: v.optional(v.string()),
  openai: v.optional(v.string()),
});

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
    memberId: v.optional(v.id('convexMembers')),
  }).index('byMemberId', ['memberId']),

  convexMembers: defineTable({
    tokenIdentifier: v.string(),
    apiKey: v.optional(apiKeyValidator),
  }).index('byTokenIdentifier', ['tokenIdentifier']),

  /*
   * All chats have two IDs -- an `initialId` that is always set (UUID) and a `urlId`
   * that is more human friendly (e.g. "tic-tac-toe").
   * The `urlId` is set based on the LLM messages so is initially unset.
   * Both `initialId` and `urlId` should be unique within the creatorId, all functions
   * should accept either `initialId` or `urlId`, and when returning an identifier,
   * we should prefer `urlId` if it is set.
   */
  chats: defineTable({
    creatorId: v.id('sessions'),
    initialId: v.string(),
    urlId: v.optional(v.string()),
    description: v.optional(v.string()),
    timestamp: v.string(),
    metadata: v.optional(v.any()), // TODO migration to remove this column
    snapshotId: v.optional(v.id('_storage')),
    convexProject: v.optional(
      v.union(
        v.object({
          kind: v.literal('connected'),
          projectSlug: v.string(),
          teamSlug: v.string(),
          // for this member's dev deployment
          deploymentUrl: v.string(),
          deploymentName: v.string(),
          warningMessage: v.optional(v.string()),
        }),
        v.object({
          kind: v.literal('connecting'),
          checkConnectionJobId: v.optional(v.id('_scheduled_functions')),
        }),
        v.object({
          kind: v.literal('failed'),
          errorMessage: v.string(),
        }),
      ),
    ),
  })
    .index('byCreatorAndId', ['creatorId', 'initialId'])
    .index('byCreatorAndUrlId', ['creatorId', 'urlId'])
    .index('bySnapshotId', ['snapshotId']),

  convexProjectCredentials: defineTable({
    projectSlug: v.string(),
    teamSlug: v.string(),
    memberId: v.optional(v.id('convexMembers')),
    projectDeployKey: v.string(),
  }).index('bySlugs', ['teamSlug', 'projectSlug']),

  chatMessages: defineTable({
    content: v.any() as VAny<SerializedMessage>,
    rank: v.number(),
    chatId: v.id('chats'),
  }).index('byChatId', ['chatId', 'rank']),
  inviteCodes: defineTable({
    code: v.string(),
    sessionId: v.id('sessions'),
    lastUsedTime: v.union(v.number(), v.null()),
    issuedReason: v.string(),
    isActive: v.boolean(),
  })
    .index('byCode', ['code'])
    .index('bySessionId', ['sessionId']),

  shares: defineTable({
    chatId: v.id('chats'),
    snapshotId: v.optional(v.id('_storage')),
    code: v.string(),

    // Shares are created at one point in time, so this makes sure
    // people using the link don’t see newer messages.
    lastMessageRank: v.number(),

    // The description of the chat at the time the share was created.
    description: v.optional(v.string()),
  })
    .index('byCode', ['code'])
    .index('bySnapshotId', ['snapshotId']),

  memberOpenAITokens: defineTable({
    memberId: v.id('convexMembers'),
    token: v.string(),
    requestsRemaining: v.number(),
    lastUsedTime: v.union(v.number(), v.null()),
  })
    .index('byMemberId', ['memberId'])
    .index('byToken', ['token']),
});
