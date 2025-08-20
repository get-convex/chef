import type { ConvexReactClient } from 'convex/react';
import { getConvexAuthToken } from './stores/sessionId';
import { VITE_PROVISION_HOST } from './convexProvisionHost';

type OptInToAccept = {
  optIn: {
    tos: string;
  };
  message: string;
};

export async function fetchOptIns(convex: ConvexReactClient): Promise<
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
  const token = getConvexAuthToken(convex);
  if (!token) {
    return {
      kind: 'missingAuth',
    };
  }
  let response: Response;
  try {
    response = await fetch(`${VITE_PROVISION_HOST}/api/dashboard/optins`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    console.error('Error fetching opt ins:', error);
    return {
      kind: 'error',
      error: 'Failed to fetch opt ins',
    };
  }
  if (!response.ok) {
    // We cannot fetch the opt ins, which means we probably failed to create an account
    // dynamically (which we can't do from Chef)
    return {
      kind: 'error',
      error: 'Failed to fetch opt ins',
    };
  }
  const optInsData: {
    optInsToAccept: OptInToAccept[];
  } = await response.json();
  return {
    kind: 'loaded',
    optIns: optInsData.optInsToAccept,
  };
}
