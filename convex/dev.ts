import { internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import schema from "./schema";
import { internal } from "./_generated/api";

export const a = 1;

export const deleteFromTable = internalMutation({
  args: { tableName: v.string() },
  handler: async (ctx, { tableName }) => {
    // Delete 4000 rows at a time
    const rows = await ctx.db.query(tableName as any).take(1000);
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));

    return rows.length !== 1000;
  },
});

export const clearAll = internalAction({
  handler: async (ctx) => {
    // Get all table names from the schema
    const tableNames = Object.keys(schema.tables);

    for (const tableName of tableNames) {
      let isCleared = false;

      while (!isCleared) {
        isCleared = await ctx.runMutation(internal.dev.deleteFromTable, { tableName });
      }
    }
  },
});

export const findSessionForUser = internalQuery({
  args: { githubMemberId: v.string() },
  handler: async (ctx, { githubMemberId }) => {
    let normalizedGithubMemberId = githubMemberId;
    if (!normalizedGithubMemberId.startsWith("github|")) {
      if (!isNaN(parseInt(normalizedGithubMemberId))) {
        normalizedGithubMemberId = `github|${normalizedGithubMemberId}`;
      } else {
        throw new Error("Invalid github member id -- these should look like github|1234567890");
      }
    }
    const convexMember = await ctx.db
      .query("convexMembers")
      .withIndex("byTokenIdentifier", (q) =>
        q.eq("tokenIdentifier", `https://auth.convex.dev/|${normalizedGithubMemberId}`),
      )
      .first();
    if (!convexMember) {
      throw new Error("Convex member not found");
    }
    const session = await ctx.db
      .query("sessions")
      .filter((q) => q.eq(q.field("memberId"), convexMember._id))
      .first();
    if (!session) {
      throw new Error("Session not found");
    }
    return session;
  },
});
