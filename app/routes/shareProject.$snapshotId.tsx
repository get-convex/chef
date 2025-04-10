import { useNavigate, useParams } from '@remix-run/react';
import { ContainerBootState, useContainerBootState } from '~/lib/stores/containerBootState';
import { Toaster } from 'sonner';
import { useConvexChatShared } from '~/lib/stores/startup';
import { useSplines } from '~/lib/splines';
import { FlexAuthWrapper } from '~/components/chat/FlexAuthWrapper';
import { Chat, SentryUserProvider } from '~/components/chat/Chat';
import { Loading } from '~/components/Loading';
import { useRef } from 'react';
import type { PartCache } from '~/lib/hooks/useMessageParser';
import { useStore } from '@nanostores/react';
import { sessionIdStore } from '~/lib/stores/sessionId';
import type { Id } from '@convex/_generated/dataModel';
import { json } from '@vercel/remix';
import type { LoaderFunctionArgs } from '@vercel/remix';
import { getFlexAuthModeInLoader } from '~/lib/persistence/convex';
import { chatIdStore, setPageLoadChatId } from '~/lib/stores/chatId';

export const loader = async (args: LoaderFunctionArgs) => {
  const url = new URL(args.request.url);
  let code: string | null = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  // If state is also set, this is probably the GitHub OAuth login flow finishing.
  // The code is probably not for us.
  if (state) {
    code = null;
  }
  const flexAuthMode = getFlexAuthModeInLoader();
  return json({ code, flexAuthMode });
};

export default function ShareProject() {
  const { snapshotId } = useParams();
  const navigate = useNavigate();

  // FIXME: save a chatId and mutation to add chat later
  const chatId = 'shared-' + snapshotId;
  setPageLoadChatId(chatId);

  if (!snapshotId) {
    throw new Error('snapshotId is required');
  }

  const { initialMessages, storeMessageHistory, initializeChat } = useConvexChatShared(
    snapshotId as Id<'_storage'>,
    chatId,
  );
  const bootState = useContainerBootState();

  let loading: null | string = null;

  // First, we need to be logged in and have a session ID.
  const sessionId = useStore(sessionIdStore);
  console.log('sessionId', sessionId);
  if (!sessionId) {
    loading = 'Logging in...';
  }
  // Then, we need to download the chat messages from the server.
  //   else if (initialMessages === undefined) {
  //     loading = 'Loading chat messages...';
  //   }
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
  const partCache = useRef<PartCache>(new Map());
  const isError = bootState.state === ContainerBootState.ERROR;
  const easterEgg = useSplines(!isError && !!loading);
  return (
    <>
      <FlexAuthWrapper>
        <SentryUserProvider>
          {loading && <Loading message={easterEgg ?? loading} />}
          {!loading && (
            <Chat
              initialMessages={initialMessages!}
              partCache={partCache.current}
              storeMessageHistory={storeMessageHistory}
              initializeChat={initializeChat}
              isReload={true}
              hadSuccessfulDeploy={false} // FIXME
            />
          )}
        </SentryUserProvider>
      </FlexAuthWrapper>
      <Toaster position="bottom-right" closeButton richColors />
    </>
  );
}
