export function getConvexUrlInLoader(): string {
  // Might be set via cloudflare, or in an `.env.local`
  const convexUrl = process.env.VITE_CONVEX_URL || globalThis.process.env.CONVEX_URL!;
  return convexUrl;
}

export function getConvexOAuthClientIdInLoader(): string {
  const convexUrl = globalThis.process.env.CONVEX_OAUTH_CLIENT_ID!;
  return convexUrl;
}

export const CONVEX_INVITE_CODE_QUERY_PARAM = 'cvx-code';
