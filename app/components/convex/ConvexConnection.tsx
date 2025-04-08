import { useEffect, useState } from 'react';
import { Dialog, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { classNames } from '~/utils/classNames';
import { convexStore, useConvexSessionIdOrNullOrLoading, useFlexAuthMode } from '~/lib/stores/convex';
import { useChatIdOrNull } from '~/lib/stores/chat';
import { useConvex, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { ConvexConnectButton } from '~/components/convex/ConvexConnectButton';

export function ConvexConnection() {
  const [isDesiredOpen, setIsOpen] = useState(false);

  const convexClient = useConvex();
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const chatId = useChatIdOrNull();
  const projectInfo = useQuery(
    api.convexProjects.loadConnectedConvexProjectCredentials,
    sessionId && chatId
      ? {
          sessionId,
          chatId,
        }
      : 'skip',
  );

  useEffect(() => {
    if (projectInfo?.kind === 'connected') {
      convexStore.set({
        token: projectInfo.adminKey,
        deploymentName: projectInfo.deploymentName,
        deploymentUrl: projectInfo.deploymentUrl,
        projectSlug: projectInfo.projectSlug,
        teamSlug: projectInfo.teamSlug,
      });
    }
  }, [projectInfo]);

  const isConnected = projectInfo !== null;

  const isOpen = isDesiredOpen;

  const handleDisconnect = async () => {
    convexStore.set(null);
    if (sessionId && chatId) {
      void convexClient.mutation(api.convexProjects.disconnectConvexProject, {
        sessionId,
        chatId,
      });
    } else {
      console.error('No sessionId or chatId so cannot disconnect');
    }
  };

  const flexAuthMode = useFlexAuthMode();

  return (
    <div className="relative">
      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden text-sm">
        <button
          onClick={() => setIsOpen(true)}
          className={classNames(
            'flex items-center gap-2 p-1.5 w-full rounded-md text-left text-bolt-elements-textPrimary bg-bolt-elements-button-secondary-background',
            'hover:bg-bolt-elements-item-backgroundAccent/90',
          )}
        >
          <img className="w-4 h-4" height="20" width="20" src="/icons/Convex.svg" alt="Convex" />
          {isConnected && projectInfo && <span className="max-w-32 truncate">{`${projectInfo.projectSlug}`}</span>}
          {!isConnected && (projectInfo ? 'Connect to Convex' : 'Connecting...')}
        </button>
      </div>

      <DialogRoot open={isOpen} onOpenChange={setIsOpen}>
        {isOpen && (
          <Dialog className="max-w-[520px] p-6" showCloseButton>
            <div className="space-y-4">
              <DialogTitle>
                <div className="px-3">{projectInfo ? 'Connected Convex Project' : 'Connect a Convex Project'}</div>
              </DialogTitle>
              <div className="flex items-center justify-between rounded-lg mx-3">
                {projectInfo && (
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-bolt-elements-textPrimary">
                      Project: {projectInfo.projectSlug}
                    </p>
                    <p className="text-sm font-medium text-bolt-elements-textPrimary">Team: {projectInfo.teamSlug}</p>
                    {flexAuthMode === 'ConvexOAuth' && (
                      <a
                        className="flex gap-1 items-center text-sm hover:underline text-bolt-elements-textSecondary"
                        href={`https://dashboard.convex.dev/p/${projectInfo.projectSlug}/settings`}
                        target="_blank"
                      >
                        View in Convex Dashboard
                        <div className="i-ph:arrow-square-out w-4 h-4" />
                      </a>
                    )}
                  </div>
                )}
                {projectInfo ? (
                  <button
                    onClick={handleDisconnect}
                    className="px-4 py-1.5 rounded-md bg-transparent hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-sm transition-colors"
                  >
                    Disconnect from Convex
                  </button>
                ) : (
                  <div className="flex justify-end gap-2">{sessionId && chatId ? <ConvexConnectButton /> : null}</div>
                )}
              </div>
            </div>
          </Dialog>
        )}
      </DialogRoot>
    </div>
  );
}
