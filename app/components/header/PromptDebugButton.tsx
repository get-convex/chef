import { TextAlignLeftIcon } from '@radix-ui/react-icons';
import { Button } from '@ui/Button';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { initialIdStore } from '~/lib/stores/chatId';
import { lazy, Suspense, useState } from 'react';
import { useStore } from '@nanostores/react';
import { useIsAdmin } from '~/hooks/useDebugPrompt';

// Import eagerly in dev to avoid a reload, lazily in prod for bundle size.
const DebugAllPromptsForChat = import.meta.env.DEV
  ? (await import('../../components/DebugPromptView')).default
  : lazy(() => import('../../components/DebugPromptView'));

export function PromptDebugButton() {
  // Note: isAdmin won't change to true unless the user vists /admin/prompt-debug.
  // That lasts one week then expires.
  const isAdmin = useQuery(api.admin.isCurrentUserAdmin);
  const [showDebugView, setShowDebugView] = useState(false);
  const chatInitialId = useStore(initialIdStore);

  const [isActivelyCheckingForAdmin, setIsActivelyCheckingForAdmin] = useState(false);

  (window as any).chefAssertAdmin = () => {
    setIsActivelyCheckingForAdmin(true);
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Button onClick={() => setShowDebugView(true)} variant="neutral" size="xs">
        <TextAlignLeftIcon />
      </Button>
      {showDebugView && chatInitialId && (
        <Suspense fallback={<div>Loading debug view...</div>}>
          <DebugAllPromptsForChat chatInitialId={chatInitialId} onClose={() => setShowDebugView(false)} />
        </Suspense>
      )}
      {isActivelyCheckingForAdmin && <ActivelyCheckForAdmin />}
    </>
  );
}

function ActivelyCheckForAdmin() {
  useIsAdmin();
  return null;
}
