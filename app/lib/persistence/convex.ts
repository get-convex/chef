import type { AppLoadContext } from '@remix-run/cloudflare';

export function getConvexUrlInLoader(context: AppLoadContext): string {
  // Might be set via cloudflare, or in an `.env.local`
  const convexUrl = (context.cloudflare.env as Record<string, any>).VITE_CONVEX_URL || process.env.CONVEX_URL;
  return convexUrl;
}

export function getConvexOAuthClientIdInLoader(context: AppLoadContext): string {
  const convexUrl =
    (context.cloudflare.env as Record<string, any>).CONVEX_OAUTH_CLIENT_ID || process.env.CONVEX_OAUTH_CLIENT_ID;
  return convexUrl;
}

export function getFlexAuthModeInLoader(context: AppLoadContext): 'InviteCode' | 'ConvexOAuth' {
  const authMode = (context.cloudflare.env as Record<string, any>).FLEX_AUTH_MODE || process.env.FLEX_AUTH_MODE;

  if (authMode === 'InviteCode') {
    return 'InviteCode';
  }
  if (authMode === 'ConvexOAuth') {
    return 'ConvexOAuth';
  }
  console.error(`FLEX_AUTH_MODE has unexpected value: ${authMode}, defaulting to ConvexOAuth`);
  return 'ConvexOAuth';
}

export const CONVEX_INVITE_CODE_QUERY_PARAM = 'cvx-code';
