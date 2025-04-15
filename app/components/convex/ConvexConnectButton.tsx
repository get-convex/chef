import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { getConvexAuthToken, useConvexSessionId } from '~/lib/stores/sessionId';
import { setSelectedTeamSlug, useSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { convexProjectStore } from '~/lib/stores/convexProject';
import { useConvex, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useChatId } from '~/lib/stores/chatId';
import { TeamSelector } from './TeamSelector';
import { Spinner } from '@ui/Spinner';
import { Link1Icon } from '@radix-ui/react-icons';

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
  const isConnected = useStore(convexProjectStore) !== null;
  const isLoading = credentials === undefined || credentials?.kind === 'connecting';

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">Select a Convex team to connect your Chef app to.</p>
      <div className="flex gap-2">
        <TeamSelector
          selectedTeamSlug={selectedTeamSlug}
          setSelectedTeamSlug={setSelectedTeamSlug}
          description="Your project will be created in this Convex team"
        />
        <button
          onClick={handleClick}
          disabled={isLoading || !selectedTeamSlug}
          className={classNames(
            'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
            'bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text hover:text-bolt-elements-button-primary-textHover',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {isLoading ? (
            <>
              <Spinner />
              Connecting...
            </>
          ) : (
            <>
              <Link1Icon />
              {isConnected ? 'Connect a different project' : 'Connect'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
