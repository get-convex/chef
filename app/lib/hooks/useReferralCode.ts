import { useQuery as useReactQuery } from '@tanstack/react-query';
import { useAuthToken } from './useDebugPrompt';
import { VITE_PROVISION_HOST } from '~/lib/convexProvisionHost';
import { useSelectedTeam } from '~/lib/stores/convexTeams';
import { queryClientStore } from '~/lib/stores/reactQueryClient';

export function useReferralCode() {
  const team = useSelectedTeam();
  return team?.referralCode || null;
}

export function useReferralStats(): { left: number } | null {
  // DISABLED: Third-party OAuth apps don't have access to dashboard API
  // Return null to hide referral features
  return null;
}

export async function bbGet(path: string, authToken: string) {
  const url = `${VITE_PROVISION_HOST}${path}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error('fetch error: ' + response.status + (await response.text()));
  }

  return await response.json();
}
