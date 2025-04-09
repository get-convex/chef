import { Chat, SentryUserProvider } from './chat/Chat';
import { FlexAuthWrapper } from './chat/FlexAuthWrapper';
import { useRef } from 'react';
import { useConvexChatHomepage } from '~/lib/stores/startup';
import { Toaster } from 'sonner';
import { setPageLoadChatId } from '~/lib/stores/chatId';
import type { Message } from '@ai-sdk/react';

export function Homepage() {
  // Set up a temporary chat ID early in app initialization. We'll
  // eventually replace this with a slug once we receive the first
  // artifact from the model if the user submits a prompt.
  const initialId = useRef(crypto.randomUUID());
  setPageLoadChatId(initialId.current);

  const { storeMessageHistory, initializeChat } = useConvexChatHomepage(initialId.current);

  // NB: On this path, we render `ChatImpl` immediately.
  return (
    <>
      <FlexAuthWrapper>
        <SentryUserProvider>
          <Chat initialMessages={emptyList} storeMessageHistory={storeMessageHistory} initializeChat={initializeChat} />
        </SentryUserProvider>
      </FlexAuthWrapper>
      <Toaster position="bottom-right" closeButton richColors />
    </>
  );
}

const emptyList: Message[] = [];