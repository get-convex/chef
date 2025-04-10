export function getConvexSiteUrl() {
  let convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL;
  if (!convexSiteUrl) {
    const convexUrl: string = import.meta.env.VITE_CONVEX_URL;
    if (convexUrl.endsWith('.convex.cloud')) {
      convexSiteUrl = convexUrl.replace('.convex.cloud', '.convex.site');
    }
  }
  if (!convexSiteUrl) {
    throw new Error('VITE_CONVEX_SITE_URL is not set');
  }
  return convexSiteUrl;
}
