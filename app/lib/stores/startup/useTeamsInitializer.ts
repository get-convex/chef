import { useEffect } from 'react';
import { convexTeamsStore, type ConvexTeam } from '~/lib/stores/convexTeams';
import { waitForConvexSessionId } from '~/lib/stores/sessionId';
import { getStoredTeamSlug, setSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { getConvexDashboardToken } from '~/lib/stores/convexDashboardAuth';
import { toast } from 'sonner';
import type { ConvexReactClient } from 'convex/react';
import { useConvex } from 'convex/react';
import { VITE_PROVISION_HOST } from '~/lib/convexProvisionHost';

export function useTeamsInitializer() {
  // DISABLED: Third-party OAuth apps don't have access to dashboard APIs
  // See: https://docs.convex.dev/platform-apis/oauth-applications
  // The /api/dashboard/teams endpoint returns 403 for third-party OAuth apps

  // const convex = useConvex();
  // useEffect(() => {
  //   void fetchTeams(convex);
  // }, [convex]);
}

async function fetchTeams(convex: ConvexReactClient) {
  let teams: ConvexTeam[];
  await waitForConvexSessionId('fetchTeams');
  try {
    // Use Convex dashboard token instead of Google auth token
    const token = getConvexDashboardToken();
    if (!token) {
      console.warn('No Convex dashboard token found. User needs to connect Convex account.');
      toast.error('Please connect your Convex account in Settings to access teams.');
      return;
    }
    const response = await fetch(`${VITE_PROVISION_HOST}/api/dashboard/teams`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      // If token is invalid, clear it
      if (response.status === 401) {
        console.error('Convex dashboard token is invalid or expired');
        toast.error('Your Convex connection expired. Please reconnect in Settings.');
        return;
      }
      throw new Error(`Failed to fetch teams: ${response.statusText}: ${body}`);
    }
    teams = await response.json();
  } catch (error) {
    console.error('Error fetching teams:', error);
    toast.error('Failed to load teams. Try reconnecting your Convex account in Settings.');
    return;
  }
  convexTeamsStore.set(teams);
  const teamSlugFromLocalStorage = getStoredTeamSlug();
  if (teamSlugFromLocalStorage) {
    const team = teams.find((team) => team.slug === teamSlugFromLocalStorage);
    if (team) {
      setSelectedTeamSlug(teamSlugFromLocalStorage);
      return;
    }
  }
  if (teams.length === 1) {
    setSelectedTeamSlug(teams[0].slug);
    return;
  }
  // Force the user to select a team.
  setSelectedTeamSlug(null);
}
