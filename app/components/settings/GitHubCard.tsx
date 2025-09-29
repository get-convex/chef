import { useConvex } from 'convex/react';
import { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { toast } from 'sonner';
import { GitHubLogoIcon, TrashIcon } from '@radix-ui/react-icons';
import { Button } from '@ui/Button';
import { captureException } from '@sentry/remix';
import { useSearchParams } from '@remix-run/react';

export function GitHubCard() {
  const convex = useConvex();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isConnecting, setIsConnecting] = useState(false);
  const [repos, setRepos] = useState<any[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);

  const githubIntegration = useQuery(api.github.getGithubIntegration);

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    if (code && !githubIntegration) {
      handleOAuthCallback(code);
    }
  }, [searchParams, githubIntegration]);

  const handleOAuthCallback = async (code: string) => {
    try {
      setIsConnecting(true);
      
      const response = await fetch(`/api/github/oauth?code=${code}`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.error) {
        toast.error(data.error);
        return;
      }

      await convex.mutation(api.github.setGithubIntegration, {
        integration: {
          accessToken: data.accessToken,
          username: data.username,
          avatarUrl: data.avatarUrl,
        },
      });

      // Clean up URL
      setSearchParams(prev => {
        prev.delete('code');
        return prev;
      });

      toast.success('GitHub connected successfully!');
    } catch (error) {
      captureException(error);
      toast.error('Failed to connect GitHub');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnect = () => {
    window.location.href = '/api/github/oauth';
  };

  const handleDisconnect = async () => {
    try {
      await convex.mutation(api.github.removeGithubIntegration);
      setRepos([]);
      toast.success('GitHub disconnected');
    } catch (error) {
      captureException(error);
      toast.error('Failed to disconnect GitHub');
    }
  };

  const loadRepos = async () => {
    try {
      setLoadingRepos(true);
      const repoData = await convex.action(api.github.getGithubRepos);
      setRepos(repoData);
    } catch (error) {
      captureException(error);
      toast.error('Failed to load repositories');
    } finally {
      setLoadingRepos(false);
    }
  };

  return (
    <div className="rounded-lg border bg-bolt-elements-background-depth-1 shadow-sm">
      <div className="p-6">
        <h2 className="mb-2 text-xl font-semibold text-content-primary">GitHub Integration</h2>
        <p className="mb-4 text-sm text-content-secondary">
          Connect your GitHub account to import and work on existing repositories.
        </p>

        {githubIntegration ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <GitHubLogoIcon className="h-5 w-5" />
              <span className="font-medium">Connected as {githubIntegration.username}</span>
              <Button
                variant="danger"
                onClick={handleDisconnect}
                icon={<TrashIcon />}
                inline
              >
                Disconnect
              </Button>
            </div>

            <div>
              <Button
                onClick={loadRepos}
                disabled={loadingRepos}
                variant="neutral"
              >
                {loadingRepos ? 'Loading...' : 'Load Repositories'}
              </Button>
            </div>

            {repos.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium">Your Repositories</h3>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {repos.map((repo) => (
                    <div
                      key={repo.id}
                      className="flex items-center justify-between p-2 rounded border"
                    >
                      <div>
                        <div className="font-medium">{repo.name}</div>
                        {repo.description && (
                          <div className="text-sm text-content-secondary">
                            {repo.description}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="neutral"
                        inline
                        onClick={() => window.open(repo.url, '_blank')}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            icon={<GitHubLogoIcon />}
          >
            {isConnecting ? 'Connecting...' : 'Connect GitHub'}
          </Button>
        )}
      </div>
    </div>
  );
}
