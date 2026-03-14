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

  const currentTeam = getStoredTeamSlug();
  const envTeamSlug = import.meta.env.VITE_DEFAULT_TEAM_SLUG?.trim() || null;
  const userInfo = localStorage.getItem('user_info');
  let parsedUserInfo: { email?: string; given_name?: string } | null = null;
  if (userInfo) {
    try {
      parsedUserInfo = JSON.parse(userInfo);
    } catch (e) {
      console.warn('Failed to parse user info for team creation:', e);
    }
  }

  const teamName = parsedUserInfo?.given_name ? `${parsedUserInfo.given_name}'s Team` : 'Personal Team';

  // Prefer configured team slug over any stale local storage value.
  if (envTeamSlug) {
    if (currentTeam && currentTeam !== envTeamSlug) {
      console.info(`Overriding stored team slug "${currentTeam}" with configured team slug "${envTeamSlug}"`);
    }
    const configuredTeam: ConvexTeam = {
      id: 'personal',
      name: teamName,
      slug: envTeamSlug,
      referralCode: '',
    };
    convexTeamsStore.set([configuredTeam]);
    setSelectedTeamSlug(envTeamSlug);
    return;
  }

  // Use the stored team only when no default is configured.
  if (currentTeam) {
    convexTeamsStore.set([
      {
        id: 'personal',
        name: teamName,
        slug: currentTeam,
        referralCode: '',
      },
    ]);
    setSelectedTeamSlug(currentTeam);
    return;
  }

  let teamSlug = 'personal';
  if (parsedUserInfo?.email) {
    // Create team slug from email (e.g., user@example.com -> user-personal)
    const emailPrefix = parsedUserInfo.email.split('@')[0].replace(/[^a-z0-9]/gi, '-').toLowerCase();
    teamSlug = emailPrefix ? `${emailPrefix}-personal` : 'personal';
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
