import { convexStore, useConvexSessionIdOrNullOrLoading } from '~/lib/stores/convex';
import { Chat, SentryUserProvider } from './chat/Chat';
import { FlexAuthWrapper } from './chat/FlexAuthWrapper';
import { useEffect, useRef } from 'react';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { useConvexChatHomepage } from '~/lib/persistence/useConvexChat';
import { Toaster } from 'sonner';
import { setPageLoadChatId, setKnownInitialId } from '~/lib/persistence/chatIdStore';

export function Homepage() {
  // Set up a temporary chat ID early in app initialization. We'll
  // eventually replace this with a slug once we receive the first
  // artifact from the model if the user submits a prompt.
  const initialId = useRef(crypto.randomUUID());
  setPageLoadChatId(initialId.current);
  setKnownInitialId(initialId.current);

  // Initialization order:
  // 1. `FlexAuthWrapper` sets the current session ID.
  // 2. We fill in a temporary chat ID right after component mount.
  // 3. Once we have both a session ID and chat ID, we fetch the
  //    current project credentials and set it in the Convex store.
  const sessionId = useConvexSessionIdOrNullOrLoading();

  const projectInfo = useQuery(
    api.convexProjects.loadConnectedConvexProjectCredentials,
    sessionId
      ? {
          sessionId,
          chatId: initialId.current,
        }
      : 'skip',
  );
  useEffect(() => {
    if (projectInfo?.kind === 'connected') {
      convexStore.set({
        token: projectInfo.adminKey,
        deploymentName: projectInfo.deploymentName,
        deploymentUrl: projectInfo.deploymentUrl,
        projectSlug: projectInfo.projectSlug,
        teamSlug: projectInfo.teamSlug,
      });
    }
  }, [projectInfo]);

  const { storeMessageHistory, initializeChat } = useConvexChatHomepage(initialId.current);

  // NB: On this path, we render `ChatImpl` immediately.
  return (
    <>
      <FlexAuthWrapper>
        <SentryUserProvider>
          <Chat initialMessages={[]} storeMessageHistory={storeMessageHistory} initializeChat={initializeChat} />
        </SentryUserProvider>
      </FlexAuthWrapper>
      <Toaster position="bottom-right" closeButton richColors />
    </>
  );
}
