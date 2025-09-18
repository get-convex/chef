import { Chat } from './chat/Chat';
import { ChefAuthProvider } from './chat/ChefAuthWrapper';
import { useRef, useMemo } from 'react';
import { useConvexChatHomepage } from '~/lib/stores/startup';
import { Toaster } from '~/components/ui/Toaster';
import { setPageLoadChatId, getPageLoadChatId } from '~/lib/stores/chatId';
import type { Message } from '@ai-sdk/react';
import type { PartCache } from '~/lib/hooks/useMessageParser';
import { UserProvider } from '~/components/UserProvider';

export function Homepage() {
  // Set up a temporary chat ID early in app initialization. We'll
  // eventually replace this with a slug once we receive the first
  // artifact from the model if the user submits a prompt.
  const initialId = useMemo(() => {
    // Check if a chat ID already exists (e.g., from React StrictMode double-render)
    const existing = getPageLoadChatId();
    if (existing) {
      return existing;
    }
    const id = crypto.randomUUID();
    setPageLoadChatId(id);
    return id;
  }, []);
  // NB: On this path, we render `ChatImpl` immediately.
  return (
    <>
      <ChefAuthProvider redirectIfUnauthenticated={false}>
        <UserProvider>
          <ChatWrapper initialId={initialId} />
        </UserProvider>
      </ChefAuthProvider>
      <Toaster />
    </>
  );
}

const ChatWrapper = ({ initialId }: { initialId: string }) => {
  const partCache = useRef<PartCache>(new Map());
  const { storeMessageHistory, initializeChat, initialMessages, subchats } = useConvexChatHomepage(initialId);
  return (
    <Chat
      initialMessages={initialMessages ?? emptyList}
      partCache={partCache.current}
      storeMessageHistory={storeMessageHistory}
      initializeChat={initializeChat}
      isReload={false}
      hadSuccessfulDeploy={false}
      subchats={subchats}
    />
  );
};

const emptyList: Message[] = [];
