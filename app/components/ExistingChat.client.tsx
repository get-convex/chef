import { api } from '@convex/_generated/api';
import { convexStore } from '~/lib/stores/convex';
import { useQuery } from 'convex/react';
import { useEffect } from 'react';
import { useChatHistoryConvex } from '~/lib/persistence';
import { useChatIdOrNull } from '~/lib/stores/chat';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/convex';
import { Chat } from './chat/Chat';
import { Toaster } from 'sonner';
import { FlexAuthWrapper } from './chat/FlexAuthWrapper';
import { SentryUserProvider } from './chat/Chat';

export function ExistingChat() {
  const { ready, initialMessages, storeMessageHistory, initializeChat } = useChatHistoryConvex();
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
