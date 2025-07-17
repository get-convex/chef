import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@ui/Button';
import { SymbolIcon } from '@radix-ui/react-icons';

export default function useVersionNotificationBanner() {
  const currentSha = process.env.VITE_VERCEL_GIT_COMMIT_SHA;
  const [productionSha, setProductionSha] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  console.log('currentSha', currentSha);
  console.log('VITE_VERCEL_GIT_COMMIT_SHA', process.env.VITE_VERCEL_GIT_COMMIT_SHA);
  console.log('VERCEL_GIT_COMMIT_SHA', process.env.VERCEL_GIT_COMMIT_SHA);

  useEffect(() => {
    async function getVersion() {
      try {
        const res = await fetch('/api/version');
        if (!res.ok) {
          throw new Error('Failed to fetch version information');
        } else {
          const data = await res.json();
          setProductionSha(data.sha);
        }
      } catch (_e) {
        setError(true);
      }
    }
    getVersion();

    const interval = setInterval(getVersion, 60 * 60 * 1000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

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
