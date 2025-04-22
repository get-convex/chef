import { useTeamsInitializer } from '~/lib/stores/startup/useTeamsInitializer';
import { ChefAuthProvider } from '~/components/chat/ChefAuthWrapper';
import type { MetaFunction } from '@vercel/remix';
import { ArrowLeftIcon } from '@radix-ui/react-icons';
import { useState, useEffect } from 'react';
import DebugAllPromptsForChat from '~/components/DebugPromptView';
import { useSearchParams } from '@remix-run/react';
import { useIsAdmin } from '~/hooks/useDebugPrompt';

export const meta: MetaFunction = () => {
  return [{ title: 'Prompt Debug | Chef Admin' }];
};

export default function PromptDebug() {
  useTeamsInitializer();

  return (
    <ChefAuthProvider redirectIfUnauthenticated={true}>
      <PromptDebugContent />
    </ChefAuthProvider>
  );
}

function PromptDebugContent() {
  const [searchParams] = useSearchParams();
  const initialId = searchParams.get('id');
  const [chatId, setChatId] = useState(initialId || '');
  const [showDebug, setShowDebug] = useState(!!initialId);
  const isAdmin = useIsAdmin();

  // Update state when URL parameter changes
  useEffect(() => {
    if (initialId) {
      setChatId(initialId);
      setShowDebug(true);
    }
  }, [initialId]);

  // If not admin, show unauthorized message
  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-bolt-elements-background-depth-2">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="mb-8 flex items-center gap-4">
            <a href="/" className="inline-flex" title="Back to Chat">
              <ArrowLeftIcon />
            </a>
            <h1 className="text-3xl font-bold text-content-primary">Prompt Debug</h1>
          </div>
          <div className="rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
            You must be a Convex admin to access this page.
          </div>
        </div>
      </div>
    );
  }

  // If still loading admin status, show nothing
  if (isAdmin === undefined) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bolt-elements-background-depth-2">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 flex items-center gap-4">
          <a href="/" className="inline-flex" title="Back to Chat">
            <ArrowLeftIcon />
          </a>
          <h1 className="text-3xl font-bold text-content-primary">Prompt Debug</h1>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Chat Initial ID
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && chatId) {
                    setShowDebug(true);
                  }
                }}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="Enter chat initial ID"
              />
            </label>
            <button
              onClick={() => chatId && setShowDebug(true)}
              disabled={!chatId}
              className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
            >
              Show Debug View
            </button>
          </div>
        </div>
      </div>

      {showDebug && (
        <DebugAllPromptsForChat chatInitialId={chatId} onClose={() => setShowDebug(false)} isDebugPage={true} />
      )}
    </div>
  );
}
