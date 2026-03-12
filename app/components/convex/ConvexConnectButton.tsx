import { getConvexAuthToken, useConvexSessionId } from '~/lib/stores/sessionId';
import { setSelectedTeamSlug, useSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { useConvex, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useChatId } from '~/lib/stores/chatId';
import { TeamSelector } from './TeamSelector';
import { Link1Icon } from '@radix-ui/react-icons';
import { Button } from '@ui/Button';
import { getConvexDashboardToken } from '~/lib/stores/convexDashboardAuth';
import { toast } from 'sonner';

export function ConvexConnectButton() {
  const convexClient = useConvex();
  const sessionId = useConvexSessionId();
  const chatId = useChatId();
  const credentials = useQuery(api.convexProjects.loadConnectedConvexProjectCredentials, {
    sessionId,
    chatId,
  });
  const selectedTeamSlug = useSelectedTeamSlug();

  const handleClick = async () => {
    if (selectedTeamSlug === null) {
      console.error('No team selected');
      return;
    }
    const dashboardToken = getConvexDashboardToken();
    const convexAuthToken = getConvexAuthToken(convexClient);
    const convexAccessToken = dashboardToken ?? convexAuthToken;
    const fallbackConvexAccessToken =
      dashboardToken && convexAuthToken && dashboardToken !== convexAuthToken ? convexAuthToken : undefined;
    if (!convexAccessToken) {
      console.error('No Convex provisioning token available');
      toast.error('Unable to authenticate with Convex. Please sign in again and retry.');
      return;
    }
    await convexClient.mutation(api.convexProjects.startProvisionConvexProject, {
      sessionId,
      chatId,
      projectInitParams: {
        teamSlug: selectedTeamSlug,
        convexAccessToken,
        fallbackConvexAccessToken,
      },
    });
  };
  const isLoading = credentials === undefined || credentials?.kind === 'connecting';

  return (
    <div className="flex flex-col gap-2">
      <p className="mb-2 text-sm text-content-secondary">Select a Convex team to connect your Chef app to.</p>
      <div className="flex items-center gap-2">
        <TeamSelector
          selectedTeamSlug={selectedTeamSlug}
          setSelectedTeamSlug={setSelectedTeamSlug}
          description="Your project will be created in this Convex team"
        />

        <Button
          icon={<Link1Icon />}
          loading={isLoading}
          disabled={isLoading || !selectedTeamSlug}
          onClick={handleClick}
        >
          {isLoading ? 'Connecting…' : 'Connect'}
        </Button>
      </div>
    </div>
  );
}
