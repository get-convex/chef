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

export const addLastFeatureId = migrations.define({
  table: "chats",
  migrateOne: async (ctx, doc) => {
    if (doc.lastFeatureId === undefined) {
      await ctx.db.patch(doc._id, { lastFeatureId: 0 });
    }
  },
});

export const runAddLastFeatureId = migrations.runner(internal.migrations.addLastFeatureId);

export const addFeatureId = migrations.define({
  table: "chatMessagesStorageState",
  migrateOne: async (ctx, doc) => {
    if (doc.featureId === undefined) {
      await ctx.db.patch(doc._id, { featureId: 0 });
    }
  },
});

export const runAddFeatureId = migrations.runner(internal.migrations.addFeatureId);

export const addLastFeatureIdToShares = migrations.define({
  table: "shares",
  migrateOne: async (ctx, doc) => {
    if (doc.lastFeatureId === undefined) {
      await ctx.db.patch(doc._id, { lastFeatureId: 0 });
    }
  },
});

export const runAddLastFeatureIdToShares = migrations.runner(internal.migrations.addLastFeatureIdToShares);
