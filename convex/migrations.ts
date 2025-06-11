import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api.js";

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

export const addLastSubchatId = migrations.define({
  table: "chats",
  migrateOne: async (ctx, doc) => {
    if (doc.lastSubchatId === undefined) {
      await ctx.db.patch(doc._id, { lastSubchatId: 0 });
    }
  },
});

export const runAddLastSubchatId = migrations.runner(internal.migrations.addLastSubchatId);

export const addSubchatId = migrations.define({
  table: "chatMessagesStorageState",
  migrateOne: async (ctx, doc) => {
    if (doc.subchatId === undefined) {
      await ctx.db.patch(doc._id, { subchatId: 0 });
    }
  },
});

export const runAddSubchatId = migrations.runner(internal.migrations.addSubchatId);

export const addLastSubchatIdToShares = migrations.define({
  table: "shares",
  migrateOne: async (ctx, doc) => {
    if (doc.lastSubchatId === undefined) {
      await ctx.db.patch(doc._id, { lastSubchatId: 0 });
    }
  },
});

export const runAddLastSubchatIdToShares = migrations.runner(internal.migrations.addLastSubchatIdToShares);
