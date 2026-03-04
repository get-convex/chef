import { useEffect } from 'react';
import { convexTeamsStore, type ConvexTeam } from '~/lib/stores/convexTeams';
import { waitForConvexSessionId } from '~/lib/stores/sessionId';
import { getStoredTeamSlug, setSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { useConvex } from 'convex/react';

export function useTeamsInitializer() {
  // DISABLED: Third-party OAuth apps don't have access to dashboard APIs
  // See: https://docs.convex.dev/platform-apis/oauth-applications
  // The /api/dashboard/teams endpoint returns 403 for third-party OAuth apps

  // Instead, we create a personal default team for each user
  const convex = useConvex();
  useEffect(() => {
    void createPersonalTeam();
  }, [convex]);
}

async function createPersonalTeam() {
  await waitForConvexSessionId('createPersonalTeam');

  // Check if team already selected
  const currentTeam = getStoredTeamSlug();
  if (currentTeam) {
    convexTeamsStore.set([{
      id: 'personal',
      name: 'Personal',
      slug: currentTeam,
      referralCode: '',
    }]);
    setSelectedTeamSlug(currentTeam);
    return;
  }

  // Get user info to create a personal team
  const userInfo = localStorage.getItem('user_info');
  let teamSlug = 'personal';
  let teamName = 'Personal';

  if (userInfo) {
    try {
      const parsed = JSON.parse(userInfo);
      const email = parsed.email || '';
      // Create team slug from email (e.g., user@example.com -> user-personal)
      const emailPrefix = email.split('@')[0].replace(/[^a-z0-9]/gi, '-').toLowerCase();
      teamSlug = emailPrefix ? `${emailPrefix}-personal` : 'personal';
      teamName = parsed.given_name ? `${parsed.given_name}'s Team` : 'Personal Team';
    } catch (e) {
      console.warn('Failed to parse user info for team creation:', e);
    }
  }

  // Create and select the personal team
  const personalTeam: ConvexTeam = {
    id: 'personal',
    name: teamName,
    slug: teamSlug,
    referralCode: '',
  };

  convexTeamsStore.set([personalTeam]);
  setSelectedTeamSlug(teamSlug);

  console.log('Created personal team:', personalTeam);
}
