import { useConvexChatExisting } from '~/lib/stores/startup';
import { Chat } from './chat/Chat';
import { Toaster } from 'sonner';
import { ChefAuthProvider } from './chat/ChefAuthWrapper';
import { setPageLoadChatId } from '~/lib/stores/chatId';
import { sessionIdStore } from '~/lib/stores/sessionId';
import { Loading } from './Loading';
import { useStore } from '@nanostores/react';
import { ContainerBootState, useContainerBootState } from '~/lib/stores/containerBootState';
import { useReloadMessages } from '~/lib/stores/startup/reloadMessages';
import { useSplines } from '~/lib/splines';
import { UserProvider } from '~/components/UserProvider';

export function ExistingChat({ chatId }: { chatId: string }) {
  // Fill in the chatID store from props early in app initialization. If this
  // chat ID ends up being invalid, we'll abandon the page and redirect to
  // the homepage.
  setPageLoadChatId(chatId);

  return (
    <>
      <ChefAuthProvider redirectIfUnauthenticated={true}>
        <UserProvider>
          <ExistingChatWrapper chatId={chatId} />
        </UserProvider>
      </ChefAuthProvider>
      <Toaster position="bottom-right" closeButton richColors />
    </>
  );
}

function ExistingChatWrapper({ chatId }: { chatId: string }) {
  const sessionId = useStore(sessionIdStore);
  const { initialMessages, storeMessageHistory, initializeChat } = useConvexChatExisting(chatId);

  const reloadState = useReloadMessages(initialMessages ?? undefined);
  const bootState = useContainerBootState();

  let loading: null | string = null;

  // First, we need to be logged in and have a session ID.
  if (!sessionId) {
    loading = 'Logging in...';
  }
  // Then, we need to download the chat messages from the server.
  else if (initialMessages === undefined) {
    loading = 'Loading chat messages...';
  }
  // Once we have the chat messages, we can populate the workbench state.
  // Note that this doesn't actually run any actions.
  else if (reloadState === undefined) {
    loading = 'Parsing chat messages...';
  }
  // Once we've loaded chat messages, let's wait on setting up the container.
  else if (bootState.state === ContainerBootState.LOADING_SNAPSHOT) {
    loading = 'Loading snapshot...';
  } else if (bootState.state === ContainerBootState.DOWNLOADING_DEPENDENCIES) {
    loading = 'Downloading dependencies...';
  } else if (bootState.state === ContainerBootState.SETTING_UP_CONVEX_PROJECT) {
    loading = 'Setting up Convex project...';
  } else if (bootState.state === ContainerBootState.SETTING_UP_CONVEX_ENV_VARS) {
    loading = 'Setting up Convex environment variables...';
  } else if (bootState.state === ContainerBootState.CONFIGURING_CONVEX_AUTH) {
    loading = 'Configuring Convex auth...';
  } else if (bootState.state === ContainerBootState.STARTING_BACKUP) {
    loading = 'Starting backup...';
  } else if (bootState.state !== ContainerBootState.READY) {
    loading = 'Loading Chef environment...';
  }

  const isError = bootState.state === ContainerBootState.ERROR;
  const easterEgg = useSplines(!isError && !!loading);

  const hadSuccessfulDeploy = initialMessages?.some(
    (message) =>
      message.role === 'assistant' &&
      message.parts?.some((part) => part.type === 'tool-invocation' && part.toolInvocation.toolName === 'deploy'),
  );

  if (initialMessages === null) {
    return <NotFound />;
  }

  return (
    <>
      {loading && <Loading message={easterEgg ?? loading} />}
      {!loading && (
        <Chat
          initialMessages={initialMessages!}
          partCache={reloadState!.partCache}
          storeMessageHistory={storeMessageHistory}
          initializeChat={initializeChat}
          isReload={true}
          hadSuccessfulDeploy={!!hadSuccessfulDeploy}
        />
      )}
    </>
  );
}

function NotFound() {
  return (
    <div className="flex h-full justify-center items-center text-center flex-col p-8">
      <h1 className="text-4xl font-bold mb-4 font-display tracking-tight text-bolt-elements-textPrimary">Not found</h1>
      <p className="text-bolt-elements-textSecondary mb-4 text-balance">
        The Chef project you’re looking for can’t be found. Maybe it was deleted or created with another account?
      </p>
      <a
        href="/"
        className="inline-flex gap-2 items-center bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text rounded-lg px-4 py-2 transition-colors"
      >
        <span className="text-sm font-medium">Return home</span>
      </a>
    </div>
  );
}
