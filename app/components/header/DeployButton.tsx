import { useState } from 'react';
import JSZip from 'jszip';
import { webcontainer } from '~/lib/webcontainer';
import type { WebContainer } from '@webcontainer/api';
import { useStore } from '@nanostores/react';
import { convexProjectStore } from '~/lib/stores/convexProject';
import { getFileUpdateCounter, useFileUpdateCounter } from '~/lib/stores/fileUpdateCounter';
import { toast } from 'sonner';
import { streamOutput } from '~/utils/process';
import { Spinner } from '@ui/Spinner';
import { CheckIcon, ExternalLinkIcon, RocketIcon, UpdateIcon } from '@radix-ui/react-icons';
import { Button } from '@ui/Button';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useChatId } from '~/lib/stores/chatId';
import { useConvexSessionId } from '~/lib/stores/sessionId';

interface ErrorResponse {
  error: string;
}

type DeployStatus =
  | { type: 'idle' }
  | { type: 'building' }
  | { type: 'zipping' }
  | { type: 'deploying' }
  | { type: 'error'; message: string }
  | { type: 'success'; updateCounter: number };

export function DeployButton() {
  const [status, setStatus] = useState<DeployStatus>({ type: 'idle' });

  const convex = useStore(convexProjectStore);
  const currentCounter = useFileUpdateCounter();
  const chatId = useChatId();
  const sessionId = useConvexSessionId();
  const recordDeploy = useMutation(api.deploy.recordDeploy);

  const addFilesToZip = async (container: WebContainer, zip: JSZip, basePath: string, currentPath: string = '') => {
    const fullPath = currentPath ? `${basePath}/${currentPath}` : basePath;
    const entries = await container.fs.readdir(fullPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await addFilesToZip(container, zip, basePath, entryPath);
      } else if (entry.isFile()) {
        const content = await container.fs.readFile(`${basePath}/${entryPath}`);
        zip.file(entryPath, content);
      }
    }
  };

  const handleDeploy = async () => {
    try {
      setStatus({ type: 'building' });
      const container = await webcontainer;

      // Run the build command
      const buildProcess = await container.spawn('vite', ['build', '--mode', 'development']);
      const { output, exitCode } = await streamOutput(buildProcess);
      if (exitCode !== 0) {
        throw new Error(`Build failed: ${output}`);
      }

      setStatus({ type: 'zipping' });
      const zip = new JSZip();
      await addFilesToZip(container, zip, 'dist');
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      setStatus({ type: 'deploying' });
      const formData = new FormData();
      formData.append('file', zipBlob, 'dist.zip');
      formData.append('deploymentName', convex!.deploymentName);
      formData.append('token', convex!.token);

      const response = await fetch('/api/deploy-simple', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = (await response.json()) as ErrorResponse | null;
        throw new Error(errorData?.error ?? 'Deployment failed');
      }

      const resp = await response.json();
      if (resp.localDevWarning) {
        toast.error(`${resp.localDevWarning}`);
      }

      const updateCounter = getFileUpdateCounter();
      setStatus({ type: 'success', updateCounter });
      await recordDeploy({ id: chatId, sessionId });
    } catch (error) {
      toast.error('Failed to deploy. Please try again.');
      console.error('Deployment error:', error);
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Deployment failed' });
    }
  };

  const isLoading = ['building', 'zipping', 'deploying'].includes(status.type);
  const isDisabled = isLoading || !convex;

  let buttonText: string;
  let icon: React.ReactNode;
  switch (status.type) {
    case 'idle':
      buttonText = 'Deploy';
      icon = <RocketIcon />;
      break;
    case 'building':
      buttonText = 'Building...';
      icon = <Spinner />;
      break;
    case 'zipping':
      buttonText = 'Creating package...';
      icon = <Spinner />;
      break;
    case 'deploying':
      buttonText = 'Deploying...';
      icon = <Spinner />;
      break;
    case 'error':
      buttonText = 'Deploy';
      icon = <RocketIcon />;
      break;
    case 'success': {
      if (status.updateCounter === currentCounter) {
        buttonText = 'Deployed';
        icon = <CheckIcon className="text-bolt-elements-icon-success" />;
      } else {
        buttonText = 'Redeploy';
        icon = <UpdateIcon />;
      }
      break;
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        disabled={isDisabled}
        onClick={handleDeploy}
        title={status.type === 'error' ? status.message : undefined}
        variant="neutral"
        size="xs"
        icon={icon}
        tip={(() => {
          switch (status.type) {
            case 'idle':
              return 'Click to deploy your application';
            case 'success':
              return 'Click to deploy again';
            default:
              return undefined;
          }
        })()}
      >
        {buttonText}
      </Button>
      {status.type === 'success' && convex && (
        <Button
          href={`https://${convex.deploymentName}.convex.app`}
          target="_blank"
          size="xs"
          icon={<ExternalLinkIcon />}
        >
          View site
        </Button>
      )}
    </div>
  );
}
