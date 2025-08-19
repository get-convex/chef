import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api.js";
import type { Doc } from "./_generated/dataModel.js";

export const migrations = new Migrations(components.migrations);
export const run = migrations.runner();

export const setDefaultDeletedFalse = migrations.define({
  table: "chats",
  migrateOne: async (ctx, doc) => {
    if (doc.isDeleted === undefined) {
      await ctx.db.patch(doc._id, { isDeleted: false });
    }
  },
});

export const runSetDefaultDeletedFalse = migrations.runner(internal.migrations.setDefaultDeletedFalse);

export const addLastSubchatIndex = migrations.define({
  table: "chats",
  migrateOne: async (ctx, doc) => {
    if (doc.lastSubchatIndex === undefined) {
      await ctx.db.patch(doc._id, { lastSubchatIndex: 0 });
    }
  },
});

export const runAddLastSubchatIndex = migrations.runner(internal.migrations.addLastSubchatIndex);

export const addSubchatIndex = migrations.define({
  table: "chatMessagesStorageState",
  migrateOne: async (ctx, doc) => {
    if (doc.subchatIndex === undefined) {
      await ctx.db.patch(doc._id, { subchatIndex: 0 });
    }
  },
});

export const runAddSubchatIndex = migrations.runner(internal.migrations.addSubchatIndex);

export const addLastSubchatIndexToShares = migrations.define({
  table: "shares",
  migrateOne: async (ctx, doc) => {
    if (doc.lastSubchatIndex === undefined) {
      await ctx.db.patch(doc._id, { lastSubchatIndex: 0 });
    }
  },
});

export const runAddLastSubchatIndexToShares = migrations.runner(internal.migrations.addLastSubchatIndexToShares);

export const addSubchatIndexToDebugChatApiRequestLog = migrations.define({
  table: "debugChatApiRequestLog",
  migrateOne: async (ctx, doc) => {
    if (doc.subchatIndex === undefined) {
      await ctx.db.patch(doc._id, { subchatIndex: 0 });
    }
  },
});

export const runAddSubchatIndexToDebugChatApiRequestLog = migrations.runner(
  internal.migrations.addSubchatIndexToDebugChatApiRequestLog,
);

export const addConvexMemberIdToConvexMembers = migrations.define({
  table: "convexMembers",
  migrateOne: async (ctx, doc) => {
    if (doc.convexMemberId === undefined && doc.cachedProfile !== undefined) {
      await ctx.db.patch(doc._id, { convexMemberId: (doc as Doc<"convexMembers">).cachedProfile?.id });
    }
  },
});

export const runAddConvexMemberIdToConvexMembers = migrations.runner(
  internal.migrations.addConvexMemberIdToConvexMembers,
);
