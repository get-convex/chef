import { useStore } from '@nanostores/react';
import { useConvex } from 'convex/react';
import { useEffect, useState } from 'react';
import { useSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { convexTeamsStore } from '~/lib/stores/convexTeams';
import { VITE_PROVISION_HOST } from '~/components/chat/Chat';
import { getConvexAuthToken } from '~/lib/stores/sessionId';
import { getTokenUsage, renderTokenCount } from '~/lib/convexUsage';
import { TeamSelector } from '~/components/convex/TeamSelector';

export function UsageCard() {
  const convex = useConvex();

  const teams = useStore(convexTeamsStore);
  useEffect(() => {
    if (teams && !selectedTeamSlug) {
      setSelectedTeamSlug(teams[0]?.slug);
    }
  }, [teams]);
  const [selectedTeamSlug, setSelectedTeamSlug] = useState(useSelectedTeamSlug() ?? teams?.[0]?.slug ?? null);

  const [isLoadingUsage, setIsLoadingUsage] = useState(true);
  const [tokenUsage, setTokenUsage] = useState<{ tokensUsed?: number; tokensQuota?: number }>({});
  useEffect(() => {
    async function fetchTokenUsage() {
      if (!selectedTeamSlug) {
        return;
      }
      setIsLoadingUsage(true);
      try {
        const token = getConvexAuthToken(convex);
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
  }, [selectedTeamSlug, convex]);

  const usagePercentage = tokenUsage.tokensQuota ? ((tokenUsage.tokensUsed || 0) / tokenUsage.tokensQuota) * 100 : 0;

  return (
    <div className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 shadow-sm">
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">Chef Usage</h2>
          <div className="ml-auto">
            <TeamSelector selectedTeamSlug={selectedTeamSlug} setSelectedTeamSlug={setSelectedTeamSlug} />
          </div>
        </div>
        <p className="mb-1 text-sm text-bolt-elements-textSecondary">
          Your Convex team comes with tokens included for Chef.
        </p>
        <p className="mb-1 text-sm text-bolt-elements-textSecondary">
          On paid Convex subscriptions, additional usage will be subject to metered billing.
        </p>
        <p className="mb-4 text-sm text-bolt-elements-textSecondary">
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
                  style={{ width: tokenUsage.tokensQuota ? `${Math.min(100, usagePercentage)}%` : '0%' }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-bolt-elements-textPrimary">
                  {Math.round(usagePercentage)}%
                </div>
              </div>
            )}
          </div>
          <p className="text-sm text-bolt-elements-textSecondary">
            {isLoadingUsage ? (
              <span className="inline-flex gap-1">
                <span className="h-4 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                {' / '}
                <span className="h-4 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                {' included tokens used this billing period.'}
              </span>
            ) : (
              <span>
                {`${renderTokenCount(tokenUsage.tokensUsed || 0)} / ${renderTokenCount(tokenUsage.tokensQuota || 0)} included tokens used this billing period.`}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
