import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Get logged-in user's cart */
export const getCart = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("cart")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

/** Add item to cart */
export const addToCart = mutation({
  args: { productId: v.id("products"), quantity: v.number() },
  handler: async (ctx, { productId, quantity }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("cart")
      .withIndex("by_user_and_product", (q) =>
        q.eq("userId", userId).eq("productId", productId),
      )
      .unique();
    if (existing) {
      return await ctx.db.patch(existing._id, {
        quantity: existing.quantity + quantity,
      });
    }
    return await ctx.db.insert("cart", {
      userId,
      productId,
      quantity,
      addedAt: Date.now(),
    });
  },
});

/** Update cart item quantity */
export const updateCartItem = mutation({
  args: { id: v.id("cart"), quantity: v.number() },
  handler: async (ctx, { id, quantity }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const item = await ctx.db.get(id);
    if (!item || item.userId !== userId) throw new Error("Not found");
    if (quantity <= 0) {
      return await ctx.db.delete(id);
    }
    return await ctx.db.patch(id, { quantity });
  },
});

/** Remove from cart */
export const removeFromCart = mutation({
  args: { id: v.id("cart") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const item = await ctx.db.get(id);
    if (!item || item.userId !== userId) throw new Error("Not found");
    return await ctx.db.delete(id);
  },
});

/** Clear user's cart */
export const clearCart = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const items = await ctx.db
      .query("cart")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(items.map((item) => ctx.db.delete(item._id)));
  },
});
