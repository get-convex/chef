import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useAnimate } from 'framer-motion';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useMessageParser, useShortcuts, useSnapScroll } from '~/lib/hooks';
import { chatIdStore, description, useChatHistoryConvex } from '~/lib/persistence';
import { chatStore, useChatIdOrNull } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { PROMPT_COOKIE_KEY } from '~/utils/constants';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { BaseChat } from './BaseChat';
import Cookies from 'js-cookie';
import { debounce } from '~/utils/debounce';
import { useSearchParams } from '@remix-run/react';
import { createSampler } from '~/utils/sampler';
import { logStore } from '~/lib/stores/logs';
import { streamingState } from '~/lib/stores/streaming';
import { filesToArtifacts } from '~/utils/fileUtils';
import { ChatContextManager } from '~/lib/ChatContextManager';
import { webcontainer } from '~/lib/webcontainer';
import {
  ContainerBootState,
  takeContainerBootError,
  useContainerBootState,
  waitForBootStepCompleted,
} from '~/lib/stores/containerBootState';
import { FlexAuthWrapper } from './FlexAuthWrapper';
import { convexStore, useConvexSessionId, useConvexSessionIdOrNullOrLoading } from '~/lib/stores/convex';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { toast, Toaster } from 'sonner';
import type { PartId } from '~/lib/stores/Artifacts';
import { captureException } from '@sentry/remix';
import { setExtra, setUser } from '@sentry/remix';
import { useAuth0 } from '@auth0/auth0-react';
import { setProfile } from '~/lib/stores/profile';

const logger = createScopedLogger('Chat');

export function Chat() {
  renderLogger.trace('Chat');

  const { ready, initialMessages, storeMessageHistory, importChat, initializeChat } = useChatHistoryConvex();
  const title = useStore(description);

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
            <ChatImpl
              description={title}
              initialMessages={initialMessages}
              storeMessageHistory={storeMessageHistory}
              importChat={importChat}
              initializeChat={initializeChat}
            />
          ) : null}
        </SentryUserProvider>
      </FlexAuthWrapper>
      <Toaster position="bottom-right" closeButton richColors />
    </>
  );
}

const processSampledMessages = createSampler(
  (options: {
    messages: Message[];
    initialMessages: Message[];
    isLoading: boolean;
    parseMessages: (messages: Message[], isLoading: boolean) => void;
    storeMessageHistory: (messages: Message[]) => Promise<void>;
  }) => {
    const { messages, initialMessages, isLoading, parseMessages, storeMessageHistory } = options;
    parseMessages(messages, isLoading);

    if (messages.length > initialMessages.length) {
      storeMessageHistory(messages).catch((error) => toast.error(error.message));
    }
  },
  50,
);

interface ChatProps {
  initialMessages: Message[];
  storeMessageHistory: (messages: Message[]) => Promise<void>;
  importChat: (description: string, messages: Message[]) => Promise<void>;
  initializeChat: (teamSlug: string) => Promise<void>;
  description?: string;
}

const ChatImpl = memo(({ description, initialMessages, storeMessageHistory, initializeChat }: ChatProps) => {
  useShortcuts();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [imageDataList, setImageDataList] = useState<string[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const actionAlert = useStore(workbenchStore.alert);

  const { showChat } = useStore(chatStore);

  const [animationScope, animate] = useAnimate();

  const chatContextManager = useRef(new ChatContextManager());

  const {
    messages,
    status,
    input,
    handleInputChange,
    setInput,
    stop,
    append,
    setMessages,
    reload,
    error,
    data: chatData,
    setData,
  } = useChat({
    initialMessages,
    initialInput: Cookies.get(PROMPT_COOKIE_KEY) || '',
    api: '/api/chat',
    sendExtraMessageFields: true,
    experimental_prepareRequestBody: ({ messages }) => {
      const chatId = chatIdStore.get() ?? '';
      const convex = convexStore.get();
      return {
        messages: chatContextManager.current.prepareContext(messages),
        firstUserMessage: messages.filter((message) => message.role == 'user').length == 1,
        chatId,
        deploymentName: convex?.deploymentName,
        token: convex?.token,
        teamSlug: convex?.teamSlug,
      };
    },
    maxSteps: 64,
    async onToolCall({ toolCall }) {
      console.log('Starting tool call', toolCall);
      const result = await workbenchStore.waitOnToolCall(toolCall.toolCallId);
      console.log('Tool call finished', result);
      return result;
    },
    onError: (e) => {
      captureException('Failed to process chat request: ' + e.message, {
        level: 'error',
        extra: {
          error: e,
        },
      });
      console.log('Error', e);
      logger.error('Request failed\n\n', e, error);
      logStore.logError('Chat request failed', e, {
        component: 'Chat',
        action: 'request',
        error: e.message,
      });
      toast.error(
        'There was an error processing your request: ' + (e.message ? e.message : 'No details were returned'),
      );
    },
    onFinish: (message, response) => {
      const usage = response.usage;
      setData(undefined);

      if (usage) {
        console.log('Token usage:', usage);
        logStore.logProvider('Chat response completed', {
          component: 'Chat',
          action: 'response',
          usage,
          messageLength: message.content.length,
        });
      }

      logger.debug('Finished streaming');
    },
  });

  const containerBootState = useContainerBootState();
  useEffect(() => {
    if (containerBootState.state === ContainerBootState.ERROR && containerBootState.errorToLog) {
      captureException(containerBootState.errorToLog);
      toast.error('Failed to initialize the Chef environment. Please reload the page.');
      takeContainerBootError();
    }
  }, [containerBootState]);

  useEffect(() => {
    const prompt = searchParams.get('prompt');

    if (!prompt) {
      return;
    }

    setSearchParams({});
    runAnimation();

    // Wait for the WebContainer to fully finish booting before sending a message.
    webcontainer.then(() => {
      append({ role: 'user', content: prompt });
    });
  }, [searchParams]);

  const { parsedMessages, parseMessages } = useMessageParser();

  const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

  useEffect(() => {
    chatStore.setKey('started', initialMessages.length > 0);
  }, []);

  useEffect(() => {
    processSampledMessages({
      messages,
      initialMessages,
      isLoading: status === 'streaming' || status === 'submitted',
      parseMessages,
      storeMessageHistory,
    });
  }, [messages, status, parseMessages]);

  const abort = () => {
    stop();
    chatStore.setKey('aborted', true);
    workbenchStore.abortAllActions();

    logStore.logProvider('Chat response aborted', {
      component: 'Chat',
      action: 'abort',
    });
  };

  useEffect(() => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.style.height = 'auto';

      const scrollHeight = textarea.scrollHeight;

      textarea.style.height = `${Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
      textarea.style.overflowY = scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
    }
  }, [input, textareaRef]);

  const toolStatus = useCurrentToolStatus();

  const runAnimation = async () => {
    if (chatStarted) {
      return;
    }

    await Promise.all([
      animate('#suggestions', { opacity: 0, display: 'none' }, { duration: 0.1 }),
      animate('#intro', { opacity: 0, flex: 1 }, { duration: 0.2, ease: cubicEasingFn }),
    ]);

    chatStore.setKey('started', true);

    setChatStarted(true);
  };

  const sendMessage = async (_event: React.UIEvent, teamSlug: string, messageInput?: string) => {
    const messageContent = messageInput || input;

    if (!messageContent?.trim()) {
      return;
    }

    if (status === 'streaming' || status === 'submitted') {
      abort();
      return;
    }
    await initializeChat(teamSlug);

    runAnimation();

    // Wait for the WebContainer to have its snapshot loaded before sending a message.
    await waitForBootStepCompleted(ContainerBootState.LOADING_SNAPSHOT);

    if (!chatStarted) {
      setMessages([
        {
          id: `${new Date().getTime()}`,
          role: 'user',
          content: messageContent,
          parts: [
            {
              type: 'text',
              text: messageContent,
            },
            ...imageDataList.map((imageData) => ({
              type: 'file' as const,
              mimeType: 'image/png',
              data: imageData,
            })),
          ],
        },
      ]);
      reload();

      return;
    }

    const modifiedFiles = workbenchStore.getModifiedFiles();

    chatStore.setKey('aborted', false);

    if (modifiedFiles !== undefined) {
      const userUpdateArtifact = filesToArtifacts(modifiedFiles, `${Date.now()}`);
      append({
        role: 'user',
        content: messageContent,
        parts: [
          {
            type: 'text',
            text: `${userUpdateArtifact}${messageContent}`,
          },
          ...imageDataList.map((imageData) => ({
            type: 'file' as const,
            mimeType: 'image/png',
            data: imageData,
          })),
        ],
      });

      workbenchStore.resetAllFileModifications();
    } else {
      append({
        role: 'user',
        content: messageContent,
        parts: [
          {
            type: 'text',
            text: messageContent,
          },
          ...imageDataList.map((imageData) => ({
            type: 'file' as const,
            mimeType: 'image/png',
            data: imageData,
          })),
        ],
      });
    }

    setInput('');
    Cookies.remove(PROMPT_COOKIE_KEY);

    setUploadedFiles([]);
    setImageDataList([]);

    textareaRef.current?.blur();
  };

  /**
   * Handles the change event for the textarea and updates the input state.
   * @param event - The change event from the textarea.
   */
  const onTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(event);
  };

  /**
   * Debounced function to cache the prompt in cookies.
   * Caches the trimmed value of the textarea input after a delay to optimize performance.
   */
  const debouncedCachePrompt = useCallback(
    debounce((event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const trimmedValue = event.target.value.trim();
      Cookies.set(PROMPT_COOKIE_KEY, trimmedValue, { expires: 30 });
    }, 1000),
    [],
  );

  const [messageRef, scrollRef] = useSnapScroll();

  return (
    <BaseChat
      ref={animationScope}
      textareaRef={textareaRef}
      input={input}
      showChat={showChat}
      chatStarted={chatStarted}
      streamStatus={status}
      onStreamingChange={(streaming) => {
        streamingState.set(streaming);
      }}
      sendMessage={sendMessage}
      messageRef={messageRef}
      scrollRef={scrollRef}
      handleInputChange={(e) => {
        onTextareaChange(e);
        debouncedCachePrompt(e);
      }}
      handleStop={abort}
      description={description}
      toolStatus={toolStatus}
      messages={messages.map((message, i) => {
        if (message.role === 'user') {
          return message;
        }
        return {
          ...message,
          content: parsedMessages[i]?.content || '',
          parts: parsedMessages[i]?.parts || [],
        };
      })}
      uploadedFiles={uploadedFiles}
      setUploadedFiles={setUploadedFiles}
      imageDataList={imageDataList}
      setImageDataList={setImageDataList}
      actionAlert={actionAlert}
      clearAlert={() => workbenchStore.clearAlert()}
      data={chatData}
      currentError={error}
    />
  );
});
ChatImpl.displayName = 'ChatImpl';

function useCurrentToolStatus() {
  const [toolStatus, setToolStatus] = useState<Record<string, ActionStatus>>({});
  useEffect(() => {
    let canceled = false;
    let artifactSubscription: (() => void) | null = null;
    const partSubscriptions: Record<PartId, () => void> = {};
    const subscribe = async () => {
      artifactSubscription = workbenchStore.artifacts.subscribe((artifacts) => {
        if (canceled) {
          return;
        }
        for (const [partId, artifactState] of Object.entries(artifacts)) {
          if (partSubscriptions[partId as PartId]) {
            continue;
          }
          const { actions } = artifactState.runner;
          const sub = actions.subscribe((actionsMap) => {
            for (const [id, action] of Object.entries(actionsMap)) {
              setToolStatus((prev) => {
                if (prev[id] !== action.status) {
                  return { ...prev, [id]: action.status };
                }
                return prev;
              });
            }
          });
          partSubscriptions[partId as PartId] = sub;
        }
      });
    };
    void subscribe();
    return () => {
      canceled = true;
      artifactSubscription?.();
      for (const sub of Object.values(partSubscriptions)) {
        sub();
      }
    };
  }, []);
  return toolStatus;
}

function SentryUserProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth0();
  const sessionId = useConvexSessionId();
  const chatId = useChatIdOrNull();

  useEffect(() => {
    setExtra('sessionId', sessionId);
  }, [sessionId]);

  useEffect(() => {
    setExtra('chatId', chatId);
  }, [chatId]);

  useEffect(() => {
    if (user) {
      setUser({
        id: user.sub ?? undefined,
        username: user.name ?? user.nickname ?? undefined,
        email: user.email ?? undefined,
      });
    }
    setProfile({
      username: user?.name ?? user?.nickname ?? '',
      avatar: user?.picture ?? '',
    });
  }, [user]);

  return children;
}
