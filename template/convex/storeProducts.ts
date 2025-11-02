import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Generate upload URL for product images */
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/** List all products (public) */
export const listProducts = query({
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    return Promise.all(
      products.map(async (product) => {
        // If image is a storage ID (starts with specific format or check if it's a valid storage ID pattern)
        // For now, we'll check if it looks like a URL. If not, assume it might be a storage ID
        let imageUrl = product.image;
        if (imageUrl && !imageUrl.startsWith("http") && !imageUrl.startsWith("https")) {
          // Try to get URL from storage
          try {
            const url = await ctx.storage.getUrl(imageUrl as any);
            if (url) imageUrl = url;
          } catch {
            // If it fails, keep the original value
          }
        }
        return { ...product, image: imageUrl };
      }),
    );
  },
});

/** Get a product by id */
export const getProduct = query({
  args: { id: v.id("products") },
  handler: async (ctx, { id }) => {
    const product = await ctx.db.get(id);
    if (!product) return null;
    // Resolve storage ID to URL if needed
    let imageUrl = product.image;
    if (imageUrl && !imageUrl.startsWith("http") && !imageUrl.startsWith("https")) {
      try {
        const url = await ctx.storage.getUrl(imageUrl as any);
        if (url) imageUrl = url;
      } catch {
        // If it fails, keep the original value
      }
    }
    return { ...product, image: imageUrl };
  },
});

/** Create product (admin only) */
export const createProduct = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    price: v.number(),
    image: v.optional(v.string()),
    stock: v.optional(v.number()),
  },
  handler: async (ctx, product) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const role = (
      await ctx.db
        .query("roles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique()
    )?.role;
    if (role !== "admin") throw new Error("Forbidden");
    return await ctx.db.insert("products", {
      ...product,
      createdAt: Date.now(),
    });
  },
});

/** Update product (admin only) */
export const updateProduct = mutation({
  args: {
    id: v.id("products"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.number()),
    image: v.optional(v.string()),
    stock: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const role = (
      await ctx.db
        .query("roles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique()
    )?.role;
    if (role !== "admin") throw new Error("Forbidden");
    return await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
  },
});

/** Delete (admin only) */
export const deleteProduct = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const role = (
      await ctx.db
        .query("roles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique()
    )?.role;
    if (role !== "admin") throw new Error("Forbidden");
    return await ctx.db.delete(id);
  },
});
