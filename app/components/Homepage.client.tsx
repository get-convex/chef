import { Chat } from './chat/Chat';
import { ChefAuthProvider } from './chat/ChefAuthWrapper';
import { useRef } from 'react';
import { useConvexChatHomepage } from '~/lib/stores/startup';
import { Toaster } from '~/components/ui/Toaster';
import { setPageLoadChatId } from '~/lib/stores/chatId';
import type { Message } from '@ai-sdk/react';
import type { PartCache } from '~/lib/hooks';
import { UserProvider } from '~/components/UserProvider';
import { useSearchParams } from '@remix-run/react';

export function Homepage() {
  // Set up a temporary chat ID early in app initialization. We'll
  // eventually replace this with a slug once we receive the first
  // artifact from the model if the user submits a prompt.
  const initialId = useRef(crypto.randomUUID());
  setPageLoadChatId(initialId.current);
  // NB: On this path, we render `ChatImpl` immediately.
  return (
    <>
      <ChefAuthProvider redirectIfUnauthenticated={false}>
        <UserProvider>
          <ChatWrapper initialId={initialId.current} />
        </UserProvider>
      </ChefAuthProvider>
      <Toaster />
    </>
  );
}

const ChatWrapper = ({ initialId }: { initialId: string }) => {
  const [searchParams, _] = useSearchParams();
  const prefill = searchParams.get('prefill');

  const partCache = useRef<PartCache>(new Map());
  const { storeMessageHistory, initializeChat } = useConvexChatHomepage(initialId);
  return (
    <Chat
      initialMessages={emptyList}
      partCache={partCache.current}
      storeMessageHistory={storeMessageHistory}
      initializeChat={initializeChat}
      isReload={false}
      hadSuccessfulDeploy={false}
      initialInput={prefill ?? undefined}
    />
  );
};

const emptyList: Message[] = [];
