import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import { getStoredTeamSlug } from '~/lib/stores/convexTeams';
import { convexTeamsStore } from '~/lib/stores/convexTeams';
import { TeamSelector } from '~/components/convex/TeamSelector';
import { Callout } from '@ui/Callout';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { Button } from '@ui/Button';
import { ProgressBar } from '@ui/ProgressBar';
import { useUsage } from '~/lib/stores/usage';
import { renderTokenCount } from '~/lib/convexUsage';

export function UsageCard() {
  const teams = useStore(convexTeamsStore);
  const [selectedTeamSlug, setSelectedTeamSlug] = useState(getStoredTeamSlug() ?? teams?.[0]?.slug ?? null);
  useEffect(() => {
    if (teams && !selectedTeamSlug) {
      setSelectedTeamSlug(teams[0]?.slug);
    }
    // No need to run if only `selectedTeamSlug` changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams]);

  const { isLoadingUsage, usagePercentage, used, quota, isPaidPlan } = useUsage({
    teamSlug: selectedTeamSlug,
  });

  return (
    <div className="rounded-lg border bg-bolt-elements-background-depth-1 shadow-sm">
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-content-primary">Chef Usage</h2>
          <div className="ml-auto">
            <TeamSelector selectedTeamSlug={selectedTeamSlug} setSelectedTeamSlug={setSelectedTeamSlug} />
          </div>
        </div>
        <p className="mb-1 text-sm text-content-secondary">Your Convex team comes with tokens included for Chef.</p>
        <p className="mb-1 text-sm text-content-secondary">
          On paid Convex subscriptions, additional usage will be subject to metered billing.
        </p>
        <p className="mb-4 text-sm text-content-secondary">
          On free plans, Chef will not be usable once you hit the limit for the current billing period.
        </p>
        <div className="space-y-4">
          <div className="w-80 max-w-80">
            {isLoadingUsage ? (
              <div className="size-full h-4 overflow-hidden rounded bg-gray-200 dark:bg-gray-700">
                <div className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-content-secondary">
                <div className="grow">
                  <ProgressBar fraction={usagePercentage / 100} variant="solid" ariaLabel="Token Usage percentage" />
                </div>
                {usagePercentage.toFixed(0)}% used
              </div>
            )}
          </div>
          <p className="text-sm text-content-secondary">
            {isLoadingUsage ? (
              <span className="inline-flex gap-1">
                <span className="h-4 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                {' / '}
                <span className="h-4 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                {' included tokens used this billing period.'}
              </span>
            ) : (
              <span>
                {`${renderTokenCount(used || 0)} / ${renderTokenCount(
                  quota || 0,
                )} included tokens used this billing period.`}
              </span>
            )}
          </p>
          {!isLoadingUsage && !isPaidPlan && used > quota ? (
            <Callout variant="upsell" className="min-w-full rounded-md">
              <div className="flex w-full flex-col gap-4">
                <h3>You&apos;ve used all the tokens included with your free plan.</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    href={`https://dashboard.convex.dev/t/${selectedTeamSlug}/settings/billing?source=chef`}
                    icon={<ExternalLinkIcon />}
                  >
                    Upgrade your plan
                  </Button>
                  <span>or add your own API key below to send more messages.</span>
                </div>
              </div>
            </Callout>
          ) : (
            <Button
              icon={<ExternalLinkIcon />}
              inline
              href={`https://dashboard.convex.dev/t/${selectedTeamSlug}/settings/billing`}
            >
              Manage Subscription
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
