import { useEffect, useState } from 'react';
import { Dialog, DialogButton, DialogClose, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { classNames } from '~/utils/classNames';
import { ConvexConnectButton } from './ConvexConnectButton';
import { convexStore, flexAuthModeStore, useConvexSessionIdOrNullOrLoading } from '~/lib/stores/convex';
import { chatStore, useChatIdOrNull } from '~/lib/stores/chat';
import { useQuery, useConvex } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useStore } from '@nanostores/react';

export function ConvexConnection({ size = 'small' }: { size?: 'small' | 'full' }) {
  const [isDesiredOpen, setIsOpen] = useState(false);

  const chatStarted = useStore(chatStore).started;

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
      });
    }
  }, [projectInfo]);

  const isConnected = projectInfo !== null;

  const forceOpen = useStore(flexAuthModeStore) === 'ConvexOAuth' && !isConnected && chatStarted;
  const isOpen = isDesiredOpen || forceOpen;
  const forcedOpen = forceOpen && !isDesiredOpen;

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

  return (
    <div className="relative">
      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden text-sm">
        <button
          onClick={() => setIsOpen(true)}
          className={classNames(
            'hover:bg-bolt-elements-item-backgroundActive flex items-center gap-2 p-1.5',
            isConnected
              ? 'bg-bolt-elements-item-backgroundDefault text-bolt-elements-item-contentAccent'
              : 'bg-bolt-elements-item-backgroundDefault text-bolt-elements-textTertiary',
          )}
        >
          <img className="w-4 h-4" height="20" width="20" src="/icons/Convex.svg" alt="Convex" />
          {isConnected && projectInfo && (
            <span className="ml-1 text-xs max-w-[100px] truncate">{`project:${projectInfo.teamSlug}:${projectInfo.projectSlug}`}</span>
          )}
          {!isConnected && size === 'full' && (
            <span className={classNames('text-bolt-elements-button-primary-text font-medium')}>Connect to Convex</span>
          )}
        </button>
      </div>

      <DialogRoot open={isOpen} onOpenChange={setIsOpen}>
        {isOpen && (
          <Dialog className="max-w-[520px] p-6" showCloseButton={!forcedOpen}>
            <div className="space-y-4">
              <DialogTitle>
                <div className="flex items-center gap-2 px-3">
                  <img className="w-5 h-5" height="24" width="24" src="/icons/Convex.svg" alt="Convex" />
                  {projectInfo ? 'Connected Convex Project' : 'Connect a Convex Project'}
                </div>
              </DialogTitle>
              <div className="flex items-center justify-between rounded-lg mx-3">
                <div>
                  {projectInfo ? (
                    <>
                      <h4 className="text-sm font-medium text-bolt-elements-textPrimary">
                        Project: {projectInfo.projectSlug}
                      </h4>
                      <p className="text-xs text-bolt-elements-textSecondary">Team: {projectInfo.teamSlug}</p>
                    </>
                  ) : (
                    <>
                      <h4 className="text-sm font-medium text-bolt-elements-textSecondary">No project connected</h4>
                      {forcedOpen && (
                        <p className="text-sm text-bolt-elements-textSecondary mt-2">
                          You're one OAuth dance away from an application running on Convex!
                        </p>
                      )}
                    </>
                  )}
                </div>
                {projectInfo ? (
                  <button
                    onClick={handleDisconnect}
                    className="px-4 py-1.5 rounded-md bg-transparent hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-sm transition-colors"
                  >
                    Disconnect
                  </button>
                ) : (
                  <div className="flex justify-end gap-2 mt-6 px-3">
                    {sessionId && chatId ? <ConvexConnectButton /> : null}
                  </div>
                )}
              </div>
              {!forcedOpen && (
                <div className="flex justify-end gap-2 mt-6 px-3">
                  <DialogClose asChild>
                    <DialogButton type="secondary" onClick={() => setIsOpen(false)}>
                      Close
                    </DialogButton>
                  </DialogClose>
                </div>
              )}
            </div>
          </Dialog>
        )}
      </DialogRoot>
    </div>
  );
}
