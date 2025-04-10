import { useStore } from '@nanostores/react';
import { profileStore } from '~/lib/stores/profile';
import { themeStore, toggleTheme } from '~/lib/stores/theme';
import { useConvex, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useEffect, useState } from 'react';
import { getTokenUsage } from '~/lib/convexUsage';
import { convexTeamsStore, useSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { toast } from 'sonner';
import { useAuth0 } from '@auth0/auth0-react';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import { TeamSelector } from '~/components/convex/TeamSelector';
import { useTeamsInitializer } from '~/lib/stores/startup/useTeamsInitializer';
import { ChefAuthProvider } from '~/components/chat/ChefAuthWrapper';
import { json } from '@vercel/remix';
import type { LoaderFunctionArgs, MetaFunction } from '@vercel/remix';
import { VITE_PROVISION_HOST } from '~/components/chat/Chat';
import { getConvexAuthToken } from '~/lib/stores/sessionId';

export const meta: MetaFunction = () => {
  return [{ title: 'Settings | Chef' }];
};

export const loader = async (args: LoaderFunctionArgs) => {
  const url = new URL(args.request.url);
  let code: string | null = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  // If state is also set, this is probably the GitHub OAuth login flow finishing.
  // The code is probably not for us.
  if (state) {
    code = null;
  }
  return json({ code });
};

export default function Settings() {
  useTeamsInitializer();

  return (
    <ChefAuthProvider redirectIfUnauthenticated={true}>
      <SettingsContent />
    </ChefAuthProvider>
  );
}

export function SettingsContent() {
  const profile = useStore(profileStore);
  const theme = useStore(themeStore);
  const convex = useConvex();
  const [tokenUsage, setTokenUsage] = useState<{ tokensUsed?: number; tokensQuota?: number }>({});
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);
  const [anthropicKey, setAnthropicKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [alwaysUseKey, setAlwaysUseKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const apiKey = useQuery(api.apiKeys.apiKeyForCurrentMember);
  const { logout } = useAuth0();

  const teams = useStore(convexTeamsStore);

  useEffect(() => {
    if (teams && !selectedTeamSlug) {
      setSelectedTeamSlug(teams[0]?.slug);
    }
  }, [teams]);
  const [selectedTeamSlug, setSelectedTeamSlug] = useState(useSelectedTeamSlug() ?? teams?.[0]?.slug ?? null);

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

  useEffect(() => {
    if (apiKey) {
      setAnthropicKey(apiKey.value || '');
      setAlwaysUseKey(apiKey.preference === 'always');
      setIsDirty(false);
    }
  }, [apiKey]);

  const handleSaveApiKey = async () => {
    setIsSaving(true);
    try {
      await convex.mutation(api.apiKeys.setApiKeyForCurrentMember, {
        apiKey: {
          preference: alwaysUseKey ? 'always' : 'quotaExhausted',
          value: anthropicKey,
        },
      });
      toast.success('API key saved successfully');
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to save API key:', error);
      toast.error('Failed to save API key');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteApiKey = async () => {
    try {
      await convex.mutation(api.apiKeys.deleteApiKeyForCurrentMember);
      toast.success('API key removed successfully');
      setAnthropicKey('');
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to remove API key:', error);
      toast.error('Failed to remove API key');
    }
  };

  const usagePercentage = tokenUsage.tokensQuota ? ((tokenUsage.tokensUsed || 0) / tokenUsage.tokensQuota) * 100 : 0;

  const handleLogout = () => {
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  };

  return (
    <div className="min-h-screen bg-bolt-elements-background-depth-2">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <a href="/" className="inline-flex" title="Back to Chat">
            <div className="i-ph:arrow-left" />
          </a>
          <h1 className="text-3xl font-bold text-bolt-elements-textPrimary">Settings</h1>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <div className="bg-bolt-elements-background-depth-1 rounded-lg shadow-sm border border-bolt-elements-borderColor">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-bolt-elements-textPrimary mb-4">Profile</h2>
              <div className="flex items-center gap-4">
                <div className="min-w-[5rem] w-20 h-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                  {profile?.avatar ? (
                    <img
                      src={profile.avatar}
                      alt={profile?.username || 'User'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="i-ph:user-fill text-4xl text-gray-400" />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-medium text-bolt-elements-textPrimary">{profile?.username || 'User'}</h3>
                  {profile?.email && <p className="text-sm text-bolt-elements-textSecondary">{profile.email}</p>}
                  <div className="flex flex-col gap-2 mt-2">
                    <a
                      href="https://dashboard.convex.dev/profile"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <div className="i-ph:arrow-square-out min-w-[1rem]" />
                      Manage your profile on the Convex Dashboard
                    </a>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 bg-transparent"
                    >
                      <div className="i-ph:sign-out min-w--[1rem]" />
                      Log out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Usage Section */}
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
                      {`${tokenUsage.tokensUsed?.toLocaleString() || 0} / ${tokenUsage.tokensQuota?.toLocaleString()} included tokens used this billing period.`}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* API Key Section */}
          <div className="bg-bolt-elements-background-depth-1 rounded-lg shadow-sm border border-bolt-elements-borderColor">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-bolt-elements-textPrimary mb-4">API Keys</h2>

              <p className="text-bolt-elements-textSecondary text-sm mb-1">
                Chef uses Anthropic APIs to generate code. You can use your own API keys to cook with Chef.
              </p>
              <p className="text-bolt-elements-textSecondary text-sm mb-4">
                See instructions for generating a key{' '}
                <a
                  href="https://docs.anthropic.com/en/api/getting-started#accessing-the-api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  here
                </a>
                .
              </p>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="anthropic-key"
                    className="block text-sm font-medium text-bolt-elements-textSecondary mb-2"
                  >
                    Anthropic API Key
                  </label>
                  {apiKey === undefined ? (
                    <div className="space-y-4">
                      <div className="relative">
                        <div className="w-full h-[42px] animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />
                        <div className="h-5 w-32 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />
                        <div className="w-4 h-4 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />
                      </div>
                      <div className="mt-4">
                        <button
                          disabled
                          className="px-2 py-1.5 bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text opacity-50 cursor-not-allowed rounded-md transition-colors w-fit"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="relative">
                        <input
                          type={showKey ? 'text' : 'password'}
                          id="anthropic-key"
                          value={anthropicKey}
                          onChange={(e) => {
                            setAnthropicKey(e.target.value);
                            setIsDirty(true);
                          }}
                          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-bolt-elements-textPrimary pr-10"
                          placeholder="sk-..."
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary bg-transparent"
                        >
                          <div className={showKey ? 'i-ph:eye-slash-bold h-4 w-4' : 'i-ph:eye-bold h-4 w-4'} />
                        </button>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="always-use-key"
                          checked={alwaysUseKey}
                          onChange={(e) => {
                            setAlwaysUseKey(e.target.checked);
                            setIsDirty(true);
                          }}
                          disabled={anthropicKey === ''}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="always-use-key" className="text-sm text-bolt-elements-textSecondary">
                          Always use my API key
                        </label>
                        <TooltipProvider>
                          <WithTooltip tooltip="When unchecked, your API key will only be used if you've run out of tokens built into your Convex plan">
                            <button
                              type="button"
                              className="text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary bg-transparent"
                            >
                              <div className="i-ph:question-bold h-4 w-4" />
                            </button>
                          </WithTooltip>
                        </TooltipProvider>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <button
                          onClick={handleSaveApiKey}
                          disabled={isSaving || !isDirty}
                          className="px-2 py-1.5 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-bolt-elements-button-primary-background rounded-md transition-colors w-fit"
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        {apiKey?.value && (
                          <button
                            onClick={handleDeleteApiKey}
                            className="px-2 py-1.5 bg-bolt-elements-button-danger-background hover:bg-bolt-elements-button-danger-backgroundHover text-bolt-elements-button-danger-text rounded-md transition-colors w-fit"
                          >
                            Remove key
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Theme Section */}
          <div className="bg-bolt-elements-background-depth-1 rounded-lg shadow-sm border border-bolt-elements-borderColor">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-bolt-elements-textPrimary mb-4">Appearance</h2>
              <div className="flex items-center justify-between">
                <span className="text-bolt-elements-textSecondary">Theme</span>
                <button
                  onClick={() => toggleTheme()}
                  className="px-4 py-2 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text rounded-lg transition-colors"
                >
                  {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
