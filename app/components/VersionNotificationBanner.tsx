import { toast } from 'sonner';
import { Button } from '@ui/Button';
import { SymbolIcon } from '@radix-ui/react-icons';
import { captureMessage } from '@sentry/remix';
import useSWR from 'swr';

export default function useVersionNotificationBanner() {
  // eslint-disable-next-line local/no-direct-process-env
  const currentSha = process.env.VERCEL_GIT_COMMIT_SHA;
  const { data, error } = useSWR<{ sha?: string | null }>('/api/version', {
    // Refresh every hour.
    refreshInterval: 1000 * 60 * 60,
    // Refresh on focus at most every 10 minutes.
    focusThrottleInterval: 1000 * 60 * 10,
    shouldRetryOnError: false,
    fetcher: versionFetcher,
  });

  if (!error && data?.sha && currentSha && data.sha !== currentSha) {
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

const versionFetcher = async (url: string) => {
  const res = await fetch(url, {
    method: 'POST',
  });

  if (!res.ok) {
    try {
      const { error } = await res.json();
      captureMessage(error);
    } catch (_e) {
      captureMessage('Failed to fetch dashboard version information.');
    }
    throw new Error('Failed to fetch dashboard version information.');
  }
  return res.json();
};
