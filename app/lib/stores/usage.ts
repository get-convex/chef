import { map, computed, onMount } from 'nanostores';
import { useStore } from '@nanostores/react';
import { useConvex } from 'convex/react';
import { convexAuthTokenStore, getConvexAuthToken } from '~/lib/stores/sessionId';
import { VITE_PROVISION_HOST } from '~/lib/convexProvisionHost';
import { debugOverrideStore, debugOverrideEnabledStore } from './debug';
import { queryClientStore } from './reactQueryClient';
import { QueryObserver } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

export function useTokenUsage(teamSlug: string | null): TeamUsageState {
  // getConvexAuthToken has a side effect may need
  const convex = useConvex();
  void getConvexAuthToken(convex);

  const usageByTeam = useStore(usageStore);

  useEffect(() => {
    if (!teamSlug) {
      return;
    }
    const subscribed = !!serverTeamUsageStore.get()[teamSlug];
    if (!subscribed) {
      serverTeamUsageStore.setKey(teamSlug, { isLoading: true, tokenUsage: null });
    }
  }, [teamSlug]);

  if (!teamSlug || !usageByTeam[teamSlug]) {
    return { isLoading: true, tokenUsage: null } as const;
  }
  const usage: TeamUsageState = usageByTeam[teamSlug];
  return usage;
}

export async function getTokenUsage(
  provisionHost: string,
  convexAuthToken: string,
  teamSlug: string,
): Promise<UsageData> {
  const url = `${provisionHost}/api/dashboard/teams/${teamSlug}/usage/get_token_info`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${convexAuthToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch usage: ${response.statusText}: ${body}`);
  }
  const {
    centitokensUsed,
    centitokensQuota,
    //isTeamDisabled,
    isPaidPlan,
  }: { centitokensUsed: number; centitokensQuota: number; isTeamDisabled: boolean; isPaidPlan: boolean } =
    await response.json();
  return {
    centitokensUsed,
    centitokensQuota,
    //isTeamDisabled,
    isPaidPlan,
  };
}

export type UsageData = {
  centitokensUsed: number;
  centitokensQuota: number;
  isPaidPlan: boolean;
};

type TeamUsageState =
  | {
      isLoading: true;
      tokenUsage: null;
    }
  | {
      isLoading: false;
      tokenUsage: UsageData;
    };

// Maintains token usage information for every team that it's ever been requested for.
export const serverTeamUsageStore = map<Record<string, TeamUsageState>>({});

const refetchForTeam: Record<string, () => Promise<void>> = {};

onMount(serverTeamUsageStore, () => {
  const unsubscribers: Map<string, () => void> = new Map();

  const setupTeamQuery = (teamSlug: string) => {
    if (unsubscribers.has(teamSlug)) {
      throw new Error(`already subscribed to team usage for ${teamSlug}`);
    }
    const observer = new QueryObserver<UsageData>(queryClientStore.get(), {
      queryKey: ['teamUsage', teamSlug],
      queryFn: async () => await getTokenUsage(VITE_PROVISION_HOST, convexAuthTokenStore.get()!, teamSlug),
      // TODO instead of fetching so much, refetch when know some tokens were just used
      refetchInterval: 10 * 60 * 1000,
    });
    refetchForTeam[teamSlug] = async () => void observer.refetch();

    const unsubscribe = observer.subscribe(({ data }) => {
      if (data) {
        serverTeamUsageStore.setKey(teamSlug, { isLoading: false, tokenUsage: data });
      }
    });

    return unsubscribe;
  };

  for (const teamSlug of Object.keys(serverTeamUsageStore.get())) {
    unsubscribers.set(teamSlug, setupTeamQuery(teamSlug));
  }

  // The API for subscribing is to add a key to this map (not a great API);
  const unsubscribeListener = serverTeamUsageStore.listen((_value, _oldValue, changedKey) => {
    if (changedKey && !unsubscribers.has(changedKey)) {
      unsubscribers.set(changedKey, setupTeamQuery(changedKey));
    }
  });

  return () => {
    unsubscribeListener();
    unsubscribers.values().map((unsub) => unsub());
  };
});

async function refetchUsageForTeam(teamSlug: string) {
  const cb = refetchForTeam[teamSlug];
  await cb?.();
}

const debugOverrideUsageStore = computed(debugOverrideStore, (store) => store.usage);
const debugEnabledUsageStore = computed(debugOverrideEnabledStore, (store) => store.usage);

export const usageStore = computed(
  [debugOverrideUsageStore, debugEnabledUsageStore, serverTeamUsageStore],
  (debugOverride, isOverriding, teamUsage): Record<string, TeamUsageState> => {
    const result: Record<string, TeamUsageState> = {};
    for (const [teamSlug, teamUsageState] of Object.entries(teamUsage)) {
      if (isOverriding && debugOverride) {
        result[teamSlug] = { isLoading: false, tokenUsage: debugOverride };
      } else {
        result[teamSlug] = teamUsageState;
      }
    }
    return result;
  },
);

export function useUsage({ teamSlug }: { teamSlug: string | null }) {
  const teamState = useTokenUsage(teamSlug);

  const usagePercentage = teamState?.tokenUsage
    ? (teamState.tokenUsage.centitokensUsed / teamState.tokenUsage.centitokensQuota) * 100
    : 0;

  const refetch = useCallback(async () => {
    if (teamSlug) {
      await refetchUsageForTeam(teamSlug);
    }
  }, [teamSlug]);

  if (!teamState || teamState.isLoading) {
    return {
      isLoadingUsage: true as const,
      usagePercentage: 0,
      used: null,
      quota: null,
      isPaidPlan: null,
      refetch,
    };
  }

  return {
    isLoadingUsage: false as const,
    usagePercentage,
    // We render centitokens as 100x smaller than their actual amount to get them
    // closer to user's expectations for Claude tokens.
    used: Math.ceil(teamState.tokenUsage.centitokensUsed / 100),
    quota: Math.ceil(teamState.tokenUsage.centitokensQuota / 100),
    isPaidPlan: teamState.tokenUsage.isPaidPlan,
    refetch,
  };
}
