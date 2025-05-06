import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api.js";

export const migrations = new Migrations(components.migrations);
export const run = migrations.runner();

export const setDefaultValue = migrations.define({
  table: "chats",
  migrateOne: async (ctx, doc) => {
    if (doc.isDeleted === undefined) {
      await ctx.db.patch(doc._id, { isDeleted: false });
    }
  },
});

export const runIt = migrations.runner(internal.migrations.setDefaultValue);
