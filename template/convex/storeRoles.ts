import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Returns role for current auth user (or null if not signed in)
 */
export const getMyRole = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const r = await ctx.db
      .query("roles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return r?.role ?? "user";
  },
});

/**
 * Admin-only mutation to assign a role to a userId.
 * Use cautiously; only initial admin seeding or admin users should call it.
 */
export const assignRole = mutation({
  args: { userId: v.id("users"), role: v.string() },
  handler: async (ctx, { userId, role }) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) throw new Error("Not authenticated");
    const current = await ctx.db
      .query("roles")
      .withIndex("by_user", (q) => q.eq("userId", currentUserId))
      .unique();
    if (!current || current.role !== "admin") throw new Error("Forbidden");
    // Upsert role for target userId
    const existing = await ctx.db
      .query("roles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) {
      return await ctx.db.patch(existing._id, { role });
    }
    return await ctx.db.insert("roles", { userId, role });
  },
});

/**
 * Utility: seed initial admin role for the current auth user.
 * Call once from the web UI after creating an account, or run from your admin console.
 * This allows new users to assign themselves as admin during signup.
 */
export const seedMyAdmin = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("roles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    // If user already has a role, don't change it
    if (existing) return existing;
    // Otherwise, assign admin role
    return await ctx.db.insert("roles", { userId, role: "admin" });
  },
});

/**
 * Allow users to set their initial role during first login.
 * Can only be called once - if a role already exists, it won't change.
 */
export const setInitialRole = mutation({
  args: { role: v.string() },
  handler: async (ctx, { role }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    // Check if user already has a role
    const existing = await ctx.db
      .query("roles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    
    // Only set role if it doesn't exist yet
    if (existing) return existing;
    
    // Validate role
    const validRole = role === "admin" ? "admin" : "user";
    return await ctx.db.insert("roles", { userId, role: validRole });
  },
});
