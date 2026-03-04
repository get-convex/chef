import type { ConvexReactClient } from 'convex/react';
import { getConvexDashboardToken } from './stores/convexDashboardAuth';
import { VITE_PROVISION_HOST } from './convexProvisionHost';

type OptInToAccept = {
  optIn: {
    tos: string;
  };
  message: string;
};

export async function fetchOptIns(): Promise<
  | {
      kind: 'loaded';
      optIns: OptInToAccept[];
    }
  | {
      kind: 'error';
      error: string;
    }
  | {
      kind: 'missingAuth';
    }
> {
  // DISABLED: Third-party OAuth apps don't have access to dashboard API
  // See: https://docs.convex.dev/platform-apis/oauth-applications
  // The /api/dashboard/optins endpoint returns 403 for third-party OAuth apps

  // Return empty optins since we can't fetch them
  return {
    kind: 'loaded',
    optIns: [],
  };
}
