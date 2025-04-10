import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';
import { convexTeamsStore, type ConvexTeam } from '~/lib/stores/convexTeams';
import { waitForConvexSessionId } from '~/lib/stores/sessionId';
import { getStoredTeamSlug, setSelectedTeamSlug } from '~/lib/stores/convexTeams';

const VITE_PROVISION_HOST = import.meta.env.VITE_PROVISION_HOST || 'https://api.convex.dev';

export function useTeamsInitializer() {
  const { getAccessTokenSilently } = useAuth0();
  useEffect(() => {
    void fetchTeams(getAccessTokenSilently);
  }, [getAccessTokenSilently]);
}

async function fetchTeams(getAccessTokenSilently: ReturnType<typeof useAuth0>['getAccessTokenSilently']) {
  let teams: ConvexTeam[];
  await waitForConvexSessionId('fetchTeams');
  try {
    const tokenResponse = await getAccessTokenSilently({
      detailedResponse: true,
    });
    const response = await fetch(`${VITE_PROVISION_HOST}/api/dashboard/teams`, {
      headers: {
        Authorization: `Bearer ${tokenResponse.id_token}`,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to fetch teams: ${response.statusText}: ${body}`);
    }
    teams = await response.json();
  } catch (error) {
    console.error('Error fetching teams:', error);
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
