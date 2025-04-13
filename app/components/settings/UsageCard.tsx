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
    <div className="bg-bolt-elements-background-depth-1 rounded-lg shadow-sm border border-bolt-elements-borderColor">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">Chef Usage</h2>
          <div className="ml-auto">
            <TeamSelector selectedTeamSlug={selectedTeamSlug} setSelectedTeamSlug={setSelectedTeamSlug} />
          </div>
        </div>
        <p className="text-sm text-bolt-elements-textSecondary mb-1">
          Your Convex team comes with tokens included for Chef.
        </p>
        <p className="text-sm text-bolt-elements-textSecondary mb-1">
          On paid Convex subscriptions, additional usage will be subject to metered billing.
        </p>
        <p className="text-sm text-bolt-elements-textSecondary mb-4">
          On free plans, Chef will not be usable once you hit the limit for the current billing period.
        </p>
        <div className="space-y-4">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden relative">
            {isLoadingUsage ? (
              <div className="h-full w-full bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
                <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </div>
            ) : (
              <div>
                <div
                  className="bg-blue-500 h-4 rounded-full transition-all duration-300"
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
                <span className="w-16 h-4 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />
                {' / '}
                <span className="w-16 h-4 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />
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
