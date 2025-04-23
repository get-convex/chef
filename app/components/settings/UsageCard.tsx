import { useStore } from '@nanostores/react';
import { useConvex } from 'convex/react';
import { useEffect, useState } from 'react';
import { getStoredTeamSlug } from '~/lib/stores/convexTeams';
import { convexTeamsStore } from '~/lib/stores/convexTeams';
import { VITE_PROVISION_HOST } from '~/components/chat/Chat';
import { getConvexAuthToken } from '~/lib/stores/sessionId';
import { getTokenUsage, renderTokenCount } from '~/lib/convexUsage';
import { TeamSelector } from '~/components/convex/TeamSelector';
import { Callout } from '@ui/Callout';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { Button } from '@ui/Button';

export function UsageCard() {
  const convex = useConvex();

  const teams = useStore(convexTeamsStore);
  const [selectedTeamSlug, setSelectedTeamSlug] = useState(getStoredTeamSlug() ?? teams?.[0]?.slug ?? null);
  useEffect(() => {
    if (teams && !selectedTeamSlug) {
      setSelectedTeamSlug(teams[0]?.slug);
    }
    // No need to run if only `selectedTeamSlug` changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams]);

  const [isLoadingUsage, setIsLoadingUsage] = useState(true);
  const [tokenUsage, setTokenUsage] = useState<{
    centitokensUsed: number;
    centitokensQuota: number;
    isPaidPlan: boolean;
  } | null>(null);
  const token = getConvexAuthToken(convex);
  useEffect(() => {
    async function fetchTokenUsage() {
      if (!selectedTeamSlug) {
        return;
      }

      setIsLoadingUsage(true);
      if (!token) {
        return;
      }
      try {
        if (token) {
          const usage = await getTokenUsage(VITE_PROVISION_HOST, token, selectedTeamSlug);
          if (usage.status === 'success') {
            setTokenUsage(usage);
          } else {
            console.error('Failed to fetch token usage:', usage.httpStatus, usage.httpBody);
          }
        }
      } catch (error) {
        console.error('Failed to fetch token usage:', error);
      } finally {
        setIsLoadingUsage(false);
      }
    }
    void fetchTokenUsage();
  }, [selectedTeamSlug, convex, token]);

  const usagePercentage = tokenUsage ? (tokenUsage.centitokensUsed / tokenUsage.centitokensQuota) * 100 : 0;

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
          <div className="relative h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            {isLoadingUsage ? (
              <div className="relative size-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                <div className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </div>
            ) : (
              <div>
                <div
                  className="h-4 rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: tokenUsage?.centitokensQuota ? `${Math.min(100, usagePercentage)}%` : '0%' }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-content-primary">
                  {Math.round(usagePercentage)}%
                </div>
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
                {`${renderTokenCount(tokenUsage?.centitokensUsed || 0)} / ${renderTokenCount(
                  tokenUsage?.centitokensQuota || 0,
                )} included tokens used this billing period.`}
              </span>
            )}
          </p>
          {tokenUsage && !tokenUsage.isPaidPlan && tokenUsage.centitokensUsed > tokenUsage.centitokensQuota ? (
            <Callout variant="upsell" className="min-w-full rounded-md">
              <div className="flex w-full flex-col gap-4">
                <h3>You&apos;ve used all the tokens included with your free plan.</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    href={`https://dashboard.convex.dev/t/${selectedTeamSlug}/settings/billing`}
                    icon={<ExternalLinkIcon />}
                  >
                    Upgrade to a paid plan
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
