import { api } from '@convex/_generated/api';
import { convexStore, setSelectedTeamSlug } from '~/lib/stores/convex';
import { useQuery } from 'convex/react';
import { useEffect } from 'react';
import { useConvexChatExisting } from '~/lib/persistence';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/convex';
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
  const sessionId = useConvexSessionIdOrNullOrLoading();
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
      setSelectedTeamSlug(projectInfo.teamSlug);
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
