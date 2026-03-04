/**
 * Phase management for Chef's AI builder
 */

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

/**
 * Update the current phase for a chat
 */
export const updatePhase = mutation({
  args: {
    chatId: v.id('chats'),
    phase: v.string(),
  },
  handler: async (ctx, { chatId, phase }) => {
    const chat = await ctx.db.get(chatId);
    if (!chat) {
      console.error(`Chat not found: ${chatId}`);
      return;
    }

    const history = chat.phaseHistory || [];
    const now = Date.now();

    // Complete previous phase if it exists and isn't completed
    if (history.length > 0) {
      const last = history[history.length - 1];
      if (!last.completedAt) {
        last.completedAt = now;
      }
    }

    // Start new phase
    history.push({
      phase,
      startedAt: now,
    });

    await ctx.db.patch(chatId, {
      currentPhase: phase,
      phaseHistory: history,
    });
  },
});

/**
 * Get the current phase for a chat
 */
export const getCurrentPhase = query({
  args: { chatId: v.id('chats') },
  handler: async (ctx, { chatId }) => {
    const chat = await ctx.db.get(chatId);
    return chat?.currentPhase || null;
  },
});

/**
 * Get the full phase history for a chat
 */
export const getPhaseHistory = query({
  args: { chatId: v.id('chats') },
  handler: async (ctx, { chatId }) => {
    const chat = await ctx.db.get(chatId);
    return chat?.phaseHistory || [];
  },
});

/**
 * Mark the current phase as completed
 */
export const completeCurrentPhase = mutation({
  args: { chatId: v.id('chats') },
  handler: async (ctx, { chatId }) => {
    const chat = await ctx.db.get(chatId);
    if (!chat || !chat.phaseHistory || chat.phaseHistory.length === 0) {
      return;
    }

    const history = chat.phaseHistory;
    const last = history[history.length - 1];

    if (!last.completedAt) {
      last.completedAt = Date.now();

      await ctx.db.patch(chatId, {
        phaseHistory: history,
      });
    }
  },
});
