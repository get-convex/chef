import { useState } from 'react';
import { Dialog, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { classNames } from '~/utils/classNames';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import { convexProjectStore } from '~/lib/stores/convexProject';
import { useChatId } from '~/lib/stores/chatId';
import { useConvex, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { ConvexConnectButton } from '~/components/convex/ConvexConnectButton';
import { ExternalLinkIcon } from '@radix-ui/react-icons';

export function ConvexConnection() {
  const [isOpen, setIsOpen] = useState(false);

  const sessionId = useConvexSessionIdOrNullOrLoading();
  const chatId = useChatId();
  const projectInfo = useQuery(
    api.convexProjects.loadConnectedConvexProjectCredentials,
    sessionId && chatId
      ? {
          sessionId,
          chatId,
        }
      : 'skip',
  );

  return (
    <div className="relative">
      <div className="flex overflow-hidden rounded-md border border-bolt-elements-borderColor text-sm">
        <button
          onClick={() => setIsOpen(true)}
          className={classNames(
            'flex items-center gap-2 p-1.5 w-full rounded-md text-left text-bolt-elements-textPrimary bg-bolt-elements-button-secondary-background',
            'hover:bg-bolt-elements-item-backgroundAccent/90',
          )}
        >
          <img className="size-4" height="20" width="20" src="/icons/Convex.svg" alt="Convex" />
          <ConnectionStatus projectInfo={projectInfo} />
        </button>
      </div>

      <DialogRoot open={isOpen} onOpenChange={setIsOpen}>
        {isOpen && (
          <Dialog className="max-w-[520px] p-6" showCloseButton>
            <div className="space-y-4">
              <DialogTitle>
                <div className="px-3">
                  {projectInfo?.kind === 'connected'
                    ? 'Connected Convex Project'
                    : projectInfo?.kind === 'connecting'
                      ? 'Connecting to Convex...'
                      : projectInfo?.kind === 'failed'
                        ? 'Failed to connect to Convex'
                        : 'Connect a Convex Project'}
                </div>
              </DialogTitle>
              <div className="mx-3 flex items-center justify-between rounded-lg">
                {projectInfo?.kind === 'connected' ? (
                  <ConnectedDialogContent projectInfo={projectInfo} />
                ) : projectInfo?.kind === 'failed' ? (
                  <ErrorDialogContent errorMessage={projectInfo.errorMessage} />
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

function ConnectedDialogContent({
  projectInfo,
}: {
  projectInfo: {
    kind: 'connected';
    projectSlug: string;
    teamSlug: string;
    deploymentUrl: string;
    deploymentName: string;
    adminKey: string;
    warningMessage: string | undefined;
  };
}) {
  const convexClient = useConvex();
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const chatId = useChatId();

  const handleDisconnect = async () => {
    convexProjectStore.set(null);
    if (sessionId) {
      void convexClient.mutation(api.convexProjects.disconnectConvexProject, {
        sessionId,
        chatId,
      });
    } else {
      console.error('No sessionId or chatId so cannot disconnect');
    }
  };

  return (
    <div className="mx-3 flex items-center justify-between rounded-lg">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-bolt-elements-textPrimary">Project: {projectInfo.projectSlug}</p>
        <p className="text-sm font-medium text-bolt-elements-textPrimary">Team: {projectInfo.teamSlug}</p>
        <a
          className="flex items-center gap-1 text-sm text-bolt-elements-textSecondary hover:underline"
          href={`https://dashboard.convex.dev/d/${projectInfo.deploymentName}`}
          target="_blank"
        >
          View in Convex Dashboard
          <ExternalLinkIcon />
        </a>
        {projectInfo.warningMessage && (
          <p className="text-sm text-bolt-elements-textSecondary">{projectInfo.warningMessage}</p>
        )}
      </div>
      <button
        onClick={handleDisconnect}
        className="rounded-md bg-transparent px-4 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
      >
        Disconnect from Convex
      </button>
    </div>
  );
}

function ErrorDialogContent({ errorMessage }: { errorMessage: string }) {
  const sessionId = useConvexSessionIdOrNullOrLoading();
  return (
    <div className="mx-3 flex items-center justify-between rounded-lg">
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-bolt-elements-textPrimary">Error: {errorMessage}</p>
        <div className="flex justify-end gap-2">{sessionId ? <ConvexConnectButton /> : null}</div>
      </div>
    </div>
  );
}

type ProjectInfo = (typeof api.convexProjects.loadConnectedConvexProjectCredentials)['_returnType'];

function ConnectionStatus({ projectInfo }: { projectInfo: ProjectInfo | undefined }) {
  if (projectInfo === undefined || projectInfo === null) {
    return <span>Connect to Convex</span>;
  }
  switch (projectInfo.kind) {
    case 'failed':
      return <span>Failed to connect</span>;
    case 'connected':
      return <span className="max-w-32 truncate">{`${projectInfo.projectSlug}`}</span>;
    case 'connecting':
      return <span>Connecting...</span>;
    default: {
      const _exhaustiveCheck: never = projectInfo;
      return <span>Connect to Convex</span>;
    }
  }
}
