import { useEffect } from 'react';
import { convexTeamsStore, type ConvexTeam } from '~/lib/stores/convexTeams';
import { getConvexAuthToken, waitForConvexSessionId } from '~/lib/stores/sessionId';
import { getStoredTeamSlug, setSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { toast } from 'sonner';
import type { ConvexReactClient } from 'convex/react';
import { useConvex } from 'convex/react';
import { VITE_PROVISION_HOST } from '~/lib/convexProvisionHost';

export function useTeamsInitializer() {
  const convex = useConvex();
  useEffect(() => {
    void fetchTeams(convex);
  }, [convex]);
}

async function fetchTeams(convex: ConvexReactClient) {
  let teams: ConvexTeam[];
  await waitForConvexSessionId('fetchTeams');
  try {
    const token = getConvexAuthToken(convex);
    if (!token) {
      throw new Error('Missing auth token');
    }
    const response = await fetch(`${VITE_PROVISION_HOST}/api/dashboard/teams`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const body = await response.text.text();
      throw new Error(`Failed to fetch teams: ${response.statusText}: ${body}`);
    }
    teams = await response.json();
  } catch (error) {
    console.error('Error fetching teams:', error);
    toast.error('Failed to load user. Try logging in at https://dashboard.convex.dev.');
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
