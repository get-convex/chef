import { convexStore, useConvexSessionIdOrNullOrLoading } from '~/lib/stores/convex';
import { Chat, SentryUserProvider } from './chat/Chat';
import { FlexAuthWrapper } from './chat/FlexAuthWrapper';
import { useEffect, useState } from 'react';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { chatIdStore, useConvexChatHomepage } from '~/lib/persistence/useConvexChat';
import { Toaster } from 'sonner';

export function Homepage() {
  // Initialization order:
  // 1. `FlexAuthWrapper` sets the current session ID.
  // 2. We fill in a temporary chat ID right after component mount.
  // 3. Once we have both a session ID and chat ID, we fetch the
  //    current project credentials and set it in the Convex store.
  const sessionId = useConvexSessionIdOrNullOrLoading();

  // Set up a temporary chat ID early in app initialization. We'll
  // eventually replace this with a slug once we receive the first
  // artifact from the model.
  const [temporaryChatId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (chatIdStore.get()) {
      throw new Error(`Chat ID already set from homepage?`);
    }
    chatIdStore.set(temporaryChatId);
  }, []);

  const projectInfo = useQuery(
    api.convexProjects.loadConnectedConvexProjectCredentials,
    sessionId
      ? {
          sessionId,
          chatId: temporaryChatId,
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

  const { storeMessageHistory, initializeChat } = useConvexChatHomepage(temporaryChatId);

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
