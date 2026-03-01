import { atom } from 'nanostores';

/**
 * Stores the Convex OAuth access token for dashboard API access.
 * This is separate from the Google OAuth token used for user authentication.
 */
export const convexDashboardTokenStore = atom<string | null>(null);

const STORAGE_KEY = 'convex_dashboard_token';

/**
 * Initialize the dashboard token from localStorage
 */
export function initConvexDashboardToken() {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      convexDashboardTokenStore.set(stored);
    }
  }
}

/**
 * Store the Convex dashboard access token
 */
export function setConvexDashboardToken(token: string) {
  convexDashboardTokenStore.set(token);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, token);
  }
}

/**
 * Get the current Convex dashboard access token
 */
export function getConvexDashboardToken(): string | null {
  return convexDashboardTokenStore.get();
}

/**
 * Clear the Convex dashboard access token
 */
export function clearConvexDashboardToken() {
  convexDashboardTokenStore.set(null);
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Check if user has connected their Convex account
 */
export function hasConvexDashboardToken(): boolean {
  return getConvexDashboardToken() !== null;
}
