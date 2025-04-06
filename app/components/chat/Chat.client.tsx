import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useAnimate } from 'framer-motion';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useMessageParser, useShortcuts, useSnapScroll } from '~/lib/hooks';
import { chatIdStore, description, useChatHistoryConvex } from '~/lib/persistence';
import { chatStore, useChatIdOrNull } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, PROMPT_COOKIE_KEY, PROVIDER_LIST } from '~/utils/constants';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { BaseChat } from './BaseChat';
import Cookies from 'js-cookie';
import { debounce } from '~/utils/debounce';
import { useSettings } from '~/lib/hooks/useSettings';
import type { ProviderInfo } from '~/types/model';
import { useSearchParams } from '@remix-run/react';
import { createSampler } from '~/utils/sampler';
import { logStore } from '~/lib/stores/logs';
import { streamingState } from '~/lib/stores/streaming';
import { filesToArtifacts } from '~/utils/fileUtils';
import { ChatContextManager } from '~/lib/ChatContextManager';
import { ContainerBootState, waitForBootStepCompleted, webcontainer } from '~/lib/webcontainer';
import { FlexAuthWrapper } from './FlexAuthWrapper';
import { convexStore, useConvexSessionIdOrNullOrLoading } from '~/lib/stores/convex';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { toast, Toaster } from 'sonner';

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
      });
    }
  }, [projectInfo]);

  return (
    <>
      <FlexAuthWrapper>
        {ready && (
          <ChatImpl
            description={title}
            initialMessages={initialMessages}
            storeMessageHistory={storeMessageHistory}
            importChat={importChat}
            initializeChat={initializeChat}
          />
        )}
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
  initializeChat: () => Promise<void>;
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
  const { activeProviders } = useSettings();

  const [model, setModel] = useState(() => {
    const savedModel = Cookies.get('selectedModel');
    return savedModel || DEFAULT_MODEL;
  });
  const [provider, setProvider] = useState(() => {
    const savedProvider = Cookies.get('selectedProvider');
    return (PROVIDER_LIST.find((p) => p.name === savedProvider) || DEFAULT_PROVIDER) as ProviderInfo;
  });

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
      const chatId = chatIdStore.get() ?? "";
      return {
        messages: chatContextManager.current.prepareContext(messages),
        firstUserMessage: messages.filter((message) => message.role == 'user').length == 1,
        chatId,
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
          model,
          provider: provider.name,
          usage,
          messageLength: message.content.length,
        });
      }

      logger.debug('Finished streaming');
    },
  });
  const isLoading = status === 'streaming' || status === 'submitted';
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
  }, [model, provider, searchParams]);

  const { parsedMessages, parseMessages } = useMessageParser();

  const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

  useEffect(() => {
    chatStore.setKey('started', initialMessages.length > 0);
  }, []);

  useEffect(() => {
    processSampledMessages({
      messages,
      initialMessages,
      isLoading,
      parseMessages,
      storeMessageHistory,
    });
  }, [messages, isLoading, parseMessages]);

  const abort = () => {
    stop();
    chatStore.setKey('aborted', true);
    workbenchStore.abortAllActions();

    logStore.logProvider('Chat response aborted', {
      component: 'Chat',
      action: 'abort',
      model,
      provider: provider.name,
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

  const sendMessage = async (_event: React.UIEvent, messageInput?: string) => {
    const messageContent = messageInput || input;

    if (!messageContent?.trim()) {
      return;
    }

    if (isLoading) {
      abort();
      return;
    }
    await initializeChat();

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

    if (error != null) {
      setMessages(messages.slice(0, -1));
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

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    Cookies.set('selectedModel', newModel, { expires: 30 });
  };

  const handleProviderChange = (newProvider: ProviderInfo) => {
    setProvider(newProvider);
    Cookies.set('selectedProvider', newProvider.name, { expires: 30 });
  };

  return (
    <BaseChat
      ref={animationScope}
      textareaRef={textareaRef}
      input={input}
      showChat={showChat}
      chatStarted={chatStarted}
      isStreaming={isLoading}
      onStreamingChange={(streaming) => {
        streamingState.set(streaming);
      }}
      sendMessage={sendMessage}
      model={model}
      setModel={handleModelChange}
      provider={provider}
      setProvider={handleProviderChange}
      providerList={activeProviders}
      messageRef={messageRef}
      scrollRef={scrollRef}
      handleInputChange={(e) => {
        onTextareaChange(e);
        debouncedCachePrompt(e);
      }}
      handleStop={abort}
      description={description}
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
    />
  );
});
ChatImpl.displayName = 'ChatImpl';
