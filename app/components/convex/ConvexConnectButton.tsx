import { getConvexAuthToken, useConvexSessionId } from '~/lib/stores/sessionId';
import { setSelectedTeamSlug, useSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { useConvex, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useChatId } from '~/lib/stores/chatId';
import { TeamSelector } from './TeamSelector';
import { Link1Icon } from '@radix-ui/react-icons';
import { Button } from '@ui/Button';

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
    const auth0AccessToken = getConvexAuthToken(convexClient);
    if (!auth0AccessToken) {
      console.error('No auth0 access token');
      return;
    }
    await convexClient.mutation(api.convexProjects.disconnectConvexProject, {
      sessionId,
      chatId,
    });

    await convexClient.mutation(api.convexProjects.startProvisionConvexProject, {
      sessionId,
      chatId,
      projectInitParams: {
        teamSlug: selectedTeamSlug,
        auth0AccessToken,
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
