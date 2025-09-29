import { ConvexError, v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { githubIntegrationValidator } from "./schema";
import { getMemberByConvexMemberIdQuery } from "./sessions";

export const getGithubIntegration = query({
  args: {},
  returns: v.union(v.null(), githubIntegrationValidator),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const member = await getMemberByConvexMemberIdQuery(ctx, identity).first();
    return member?.githubIntegration || null;
  },
});

export const setGithubIntegration = mutation({
  args: {
    integration: githubIntegrationValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }

    const member = await getMemberByConvexMemberIdQuery(ctx, identity).first();
    if (!member) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }

    await ctx.db.patch(member._id, { githubIntegration: args.integration });
  },
});

export const removeGithubIntegration = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }

    const member = await getMemberByConvexMemberIdQuery(ctx, identity).first();
    if (!member) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }

    await ctx.db.patch(member._id, { githubIntegration: undefined });
  },
});

export const getGithubRepos = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "NotAuthorized", message: "Unauthorized" });
    }

    const member = await ctx.runQuery(getMemberByConvexMemberIdQuery, identity);
    if (!member?.githubIntegration) {
      throw new ConvexError({ code: "NotFound", message: "GitHub integration not found" });
    }

    const response = await fetch("https://api.github.com/user/repos?sort=updated&per_page=50", {
      headers: {
        Authorization: `Bearer ${member.githubIntegration.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      throw new ConvexError({ code: "BadRequest", message: "Failed to fetch repositories" });
    }

    const repos = await response.json();
    return repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      updatedAt: repo.updated_at,
      language: repo.language,
      url: repo.html_url,
    }));
  },
});
