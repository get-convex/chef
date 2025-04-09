import { useState } from 'react';
import JSZip from 'jszip';
import { webcontainer } from '~/lib/webcontainer';
import type { WebContainer } from '@webcontainer/api';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { convexProjectStore } from '~/lib/stores/convexProject';
import { getFileUpdateCounter, useFileUpdateCounter } from '~/lib/stores/fileUpdateCounter';
import { toast } from 'sonner';
import { streamOutput } from '~/utils/process';

interface ErrorResponse {
  error: string;
}

interface ButtonProps {
  active?: boolean;
  disabled?: boolean;
  children?: any;
  onClick?: VoidFunction;
  className?: string;
  title?: string;
  href?: string;
  target?: string;
  rel?: string;
}

function Button({
  active = false,
  disabled = false,
  children,
  onClick,
  className,
  title,
  href,
  target,
  rel,
}: ButtonProps) {
  const sharedClassName = classNames(
    'flex items-center gap-1 p-1 text-sm border border-bolt-elements-borderColor rounded-md',
    {
      'bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary hover:text-bolt-elements-textPrimary':
        !active,
      'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': active && !disabled,
      'bg-bolt-elements-item-backgroundDefault text-alpha-gray-20 dark:text-alpha-white-20 cursor-not-allowed hover:bg-bolt-elements-item-backgroundDefault hover:text-bolt-elements-textTertiary':
        disabled,
    },
    className,
  );

  if (href) {
    return (
      <a href={href} target={target} rel={rel} className={sharedClassName}>
        {children}
      </a>
    );
  }

  return (
    <button className={sharedClassName} disabled={disabled} onClick={onClick} title={title}>
      {children}
    </button>
  );
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
      const buildProcess = await container.spawn('npx', ['vite', 'build', '--mode', 'development']);
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

      const updateCounter = getFileUpdateCounter();
      setStatus({ type: 'success', updateCounter });
    } catch (error) {
      toast.error('Failed to deploy. Please try again.');
      console.error('Deployment error:', error);
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Deployment failed' });
    }
  };

  const isLoading = ['building', 'zipping', 'deploying'].includes(status.type);
  const isDisabled = isLoading || !convex;

  let buttonText: string;
  let icon: string;
  switch (status.type) {
    case 'idle':
      buttonText = 'Deploy';
      icon = 'i-ph:rocket-launch';
      break;
    case 'building':
      buttonText = 'Building...';
      icon = 'i-ph:spinner-gap animate-spin';
      break;
    case 'zipping':
      buttonText = 'Creating package...';
      icon = 'i-ph:spinner-gap animate-spin';
      break;
    case 'deploying':
      buttonText = 'Deploying...';
      icon = 'i-ph:spinner-gap animate-spin';
      break;
    case 'error':
      buttonText = 'Deploy';
      icon = 'i-ph:rocket-launch';
      break;
    case 'success': {
      if (status.updateCounter === currentCounter) {
        buttonText = 'Deployed';
        icon = 'i-ph:check text-green-500';
      } else {
        buttonText = 'Redeploy';
        icon = 'i-ph:arrows-clockwise';
      }
      break;
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button disabled={isDisabled} onClick={handleDeploy} title={status.type === 'error' ? status.message : undefined}>
        <div className={classNames('w-4 h-4', icon)} />
        <span>{buttonText}</span>
      </Button>
      {status.type === 'success' && convex && (
        <Button
          href={`https://${convex.deploymentName}.convex.app`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1"
        >
          <div className="i-ph:arrow-square-out w-4 h-4" />
          <span>View site</span>
        </Button>
      )}
    </div>
  );
}
