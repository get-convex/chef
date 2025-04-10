import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { apiKeyValidator } from './schema';

export const apiKeyForCurrentMember = query({
  args: {},
  returns: v.union(v.null(), apiKeyValidator),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const existingMember = await ctx.db
      .query('convexMembers')
      .withIndex('byTokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
      .unique();

    return existingMember?.apiKey;
  },
});

export const setApiKeyForCurrentMember = mutation({
  args: {
    apiKey: apiKeyValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: 'NotAuthorized', message: 'Unauthorized' });
    }

    const existingMember = await ctx.db
      .query('convexMembers')
      .withIndex('byTokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
      .unique();

    if (!existingMember) {
      throw new ConvexError({ code: 'NotAuthorized', message: 'Unauthorized' });
    }

    await ctx.db.patch(existingMember._id, { apiKey: args.apiKey });
  },
});

export const deleteApiKeyForCurrentMember = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: 'NotAuthorized', message: 'Unauthorized' });
    }

    const existingMember = await ctx.db
      .query('convexMembers')
      .withIndex('byTokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
      .unique();

    if (!existingMember) {
      throw new ConvexError({ code: 'NotAuthorized', message: 'Unauthorized' });
    }

    await ctx.db.patch(existingMember._id, { apiKey: undefined });
  },
});
