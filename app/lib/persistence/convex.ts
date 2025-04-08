export function getConvexUrlInLoader(): string {
  // Might be set via cloudflare, or in an `.env.local`
  const convexUrl = process.env.VITE_CONVEX_URL || globalThis.process.env.CONVEX_URL!;
  return convexUrl;
}

export function getConvexOAuthClientIdInLoader(): string {
  const convexUrl = globalThis.process.env.CONVEX_OAUTH_CLIENT_ID!;
  return convexUrl;
}

export function getFlexAuthModeInLoader(): 'InviteCode' | 'ConvexOAuth' {
  const authMode = globalThis.process.env.FLEX_AUTH_MODE;

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
