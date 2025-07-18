import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@ui/Button';
import { SymbolIcon } from '@radix-ui/react-icons';

export default function useVersionNotificationBanner() {
  // @eslint-disable-next-line local/no-direct-process-env
  const currentSha = process.env.VERCEL_GIT_COMMIT_SHA;
  const [productionSha, setProductionSha] = useState<string>('');
  const [error, setError] = useState<boolean>(false);

  console.log('currentSha', currentSha);

  useEffect(() => {
    async function getVersion() {
      try {
        const res = await fetch('/api/version', {
          method: 'POST',
        });
        console.log('res', res);
        if (!res.ok) {
          throw new Error('Failed to fetch version information');
        } else {
          const data = await res.json();
          setProductionSha(data.sha);
          console.log('productionSha', productionSha);
        }
      } catch (_e) {
        setError(true);
      }
    }
    getVersion();

    // TODO: Change to 60 * 60 * 1000
    const interval = setInterval(getVersion, 1000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [productionSha]);

  if (!error && productionSha && currentSha && productionSha !== currentSha) {
    toast.info(
      <div className="flex flex-col">
        A new version of Chef is available! Refresh this page to update.
        <Button
          className="ml-auto w-fit items-center"
          inline
          size="xs"
          icon={<SymbolIcon />}
          // Make the href the current page so that the page refreshes.
          onClick={() => window.location.reload()}
        >
          Refresh
        </Button>
      </div>,
      {
        id: 'chefVersion',
        duration: Number.POSITIVE_INFINITY,
      },
    );
  }
}
