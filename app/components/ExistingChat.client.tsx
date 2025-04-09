import { useConvexChatExisting } from '~/lib/persistence';
import { Chat } from './chat/Chat';
import { Toaster } from 'sonner';
import { FlexAuthWrapper } from './chat/FlexAuthWrapper';
import { SentryUserProvider } from './chat/Chat';
import { setPageLoadChatId } from '~/lib/persistence/chatIdStore';

export function ExistingChat({ chatId }: { chatId: string }) {
  // Fill in the chatID store from props early in app initialization. If this
  // chat ID ends up being invalid, we'll abandon the page and redirect to
  // the homepage.
  setPageLoadChatId(chatId);
  const { ready, initialMessages, storeMessageHistory, initializeChat } = useConvexChatExisting(chatId);
  return (
    <>
      <FlexAuthWrapper>
        <SentryUserProvider>
          {ready ? (
            <Chat
              initialMessages={initialMessages}
              storeMessageHistory={storeMessageHistory}
              initializeChat={initializeChat}
            />
          ) : null}
        </SentryUserProvider>
      </FlexAuthWrapper>
      <Toaster position="bottom-right" closeButton richColors />
    </>
  );
}
