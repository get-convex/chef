import { useTeamsInitializer } from '~/lib/stores/startup/useTeamsInitializer';
import { ChefAuthProvider } from '~/components/chat/ChefAuthWrapper';
import { json } from '@vercel/remix';
import type { LoaderFunctionArgs, MetaFunction } from '@vercel/remix';
import { ApiKeyCard } from '~/components/settings/ApiKeyCard';
import { ThemeCard } from '~/components/settings/ThemeCard';
import { ProfileCard } from '~/components/settings/ProfileCard';
import { UsageCard } from '~/components/settings/UsageCard';

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
          <ProfileCard />
          <UsageCard />
          <ApiKeyCard />
          <ThemeCard />
        </div>
      </div>
    </div>
  );
}
