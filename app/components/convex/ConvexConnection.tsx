import { useState } from 'react';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import { useChatId } from '~/lib/stores/chatId';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { ConvexConnectButton } from '~/components/convex/ConvexConnectButton';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { Button } from '@ui/Button';
import { Modal } from '@ui/Modal';
import { Callout } from '@ui/Callout';

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
      <Button
        variant="neutral"
        onClick={() => setIsOpen(true)}
        size="xs"
        className="text-xs font-normal"
        icon={<img className="size-4" height="16" width="16" src="/icons/Convex.svg" alt="Convex" />}
      >
        <ConnectionStatus projectInfo={projectInfo} />
      </Button>

      {isOpen && (
        <Modal
          title={
            projectInfo?.kind === 'connected'
              ? 'Connected Convex Project'
              : projectInfo?.kind === 'connecting'
                ? 'Connecting to Convex…'
                : projectInfo?.kind === 'failed'
                  ? 'Failed to connect to Convex'
                  : 'Connect a Convex Project'
          }
          onClose={() => setIsOpen(false)}
        >
          {projectInfo?.kind === 'connected' ? (
            <ConnectedDialogContent projectInfo={projectInfo} />
          ) : projectInfo?.kind === 'failed' ? (
            <ErrorDialogContent errorMessage={projectInfo.errorMessage} />
          ) : (
            sessionId && chatId && <ConvexConnectButton />
          )}
        </Modal>
      )}
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
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const chatId = useChatId();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-content-tertiary">
          Current Project: <strong className="font-semibold text-content-primary">{projectInfo.projectSlug}</strong>
        </p>
        <p className="text-sm text-content-tertiary">
          Team: <strong className="font-semibold text-content-primary">{projectInfo.teamSlug}</strong>
        </p>
        <a
          className="flex items-center gap-1 text-sm text-content-secondary hover:underline"
          href={`https://dashboard.convex.dev/d/${projectInfo.deploymentName}`}
          target="_blank"
          rel="noreferrer"
        >
          View in Convex Dashboard
          <ExternalLinkIcon />
        </a>
        {projectInfo.warningMessage && <p className="text-sm text-content-secondary">{projectInfo.warningMessage}</p>}
      </div>

      <div className="border-t pt-4">
        <p className="mb-3 text-sm font-medium text-content-primary">Connect to a new Convex project</p>
        {sessionId && chatId && <ConvexConnectButton />}
      </div>
    </div>
  );
}

function ErrorDialogContent({ errorMessage }: { errorMessage: string }) {
  const sessionId = useConvexSessionIdOrNullOrLoading();
  return (
    <div className="flex w-full flex-col gap-4">
      <Callout variant="error">
        <p>Error: {errorMessage}</p>
      </Callout>
      {sessionId && <ConvexConnectButton />}
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
      return <span className="max-w-24 truncate">{`${projectInfo.projectSlug}`}</span>;
    case 'connecting':
      return <span>Connecting…</span>;
    default: {
      const _exhaustiveCheck: never = projectInfo;
      return <span>Connect to Convex</span>;
    }
  }
}
