import { useStore } from '@nanostores/react';
import { memo, useEffect, useRef } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { convexProjectStore } from '~/lib/stores/convexProject';
import { ExternalLinkIcon } from '@radix-ui/react-icons';

export const Dashboard = memo(() => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const convexProject = useStore(convexProjectStore);

  if (!convexProject) {
    throw new Error('No Convex project connected');
  }

  const { deploymentUrl, token, deploymentName } = convexProject;

  const actualUrl = 'https://dashboard-embedded.convex.dev/data';
  const shownUrl = `https://dashboard.convex.dev/d/${deploymentName}/`;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!deploymentUrl || !token || !deploymentName) {
        return;
      }

      if (event.data?.type !== 'dashboard-credentials-request') {
        return;
      }

      const iframe = iframeRef.current;

      if (!iframe) {
        throw new Error('iframe ref not found');
      }

      iframeRef.current.contentWindow?.postMessage(
        {
          type: 'dashboard-credentials',
          adminKey: token,
          deploymentUrl,
          deploymentName,
        },
        '*',
      );
    };

    window.addEventListener('message', handleMessage);

    return () => window.removeEventListener('message', handleMessage);
  }, [deploymentUrl, token, deploymentName]);

  return (
    <div className="flex size-full flex-col">
      <div className="flex items-center gap-1.5 bg-bolt-elements-background-depth-2 p-2">
        <div
          className="flex grow items-center gap-1 rounded-full border border-bolt-elements-borderColor bg-bolt-elements-preview-addressBar-background px-3 py-1 text-sm text-bolt-elements-preview-addressBar-text focus-within:border-bolt-elements-borderColorActive focus-within:bg-bolt-elements-preview-addressBar-backgroundActive focus-within:text-bolt-elements-preview-addressBar-textActive
          hover:bg-bolt-elements-preview-addressBar-backgroundHover hover:focus-within:bg-bolt-elements-preview-addressBar-backgroundActive"
        >
          <input ref={inputRef} className="w-full bg-transparent outline-none" type="text" value={shownUrl} disabled />
        </div>
        <IconButton
          icon={<ExternalLinkIcon />}
          onClick={() => {
            window.open(shownUrl, '_blank');
          }}
          title={`Open dashboard in new tab`}
        />
      </div>
      <div className="flex-1 border-t border-bolt-elements-borderColor">
        <iframe ref={iframeRef} className="sentry-mask size-full border-none bg-white" src={actualUrl} />
      </div>
    </div>
  );
});
