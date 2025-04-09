import { convexStore, useConvexSessionIdOrNullOrLoading } from '~/lib/stores/convex';
import { Chat, SentryUserProvider } from './chat/Chat';
import { FlexAuthWrapper } from './chat/FlexAuthWrapper';
import { useChatIdOrNull } from '~/lib/stores/chat';
import { useEffect } from 'react';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { useChatHistoryConvex } from '~/lib/persistence/useChatHistory';
import { Toaster } from 'sonner';

export function Homepage() {
  // Initialization order:
  // 1. `FlexAuthWrapper` sets the current session ID.
  // 2. We don't have a chat ID until `initializeChat` is called. This
  //    fills in a temporary UUID chat ID until the model emits the
  //    first artifact with a nice slug.
  // 3. Once we have both a session ID and chat ID, we fetch the
  //    current project credentials and set it in the Convex store.
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const chatId = useChatIdOrNull();
  const projectInfo = useQuery(
    api.convexProjects.loadConnectedConvexProjectCredentials,
    sessionId && chatId
      ? {
          sessionId,
          chatId,
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

  const { storeMessageHistory, initializeChat } = useChatHistoryConvex();

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
