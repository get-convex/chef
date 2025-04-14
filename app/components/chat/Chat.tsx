import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useAnimate } from 'framer-motion';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useMessageParser, useSnapScroll, type PartCache } from '~/lib/hooks';
import { description } from '~/lib/stores/description';
import { chatStore } from '~/lib/stores/chatId';
import { workbenchStore } from '~/lib/stores/workbench.client';
import { PROMPT_COOKIE_KEY, type ModelSelection } from '~/utils/constants';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger } from '~/utils/logger';
import { BaseChat } from './BaseChat.client';
import Cookies from 'js-cookie';
import { debounce } from '~/utils/debounce';
import { useSearchParams } from '@remix-run/react';
import { createSampler } from '~/utils/sampler';
import { filesToArtifacts } from '~/utils/fileUtils';
import { ChatContextManager } from '~/lib/ChatContextManager';
import { webcontainer } from '~/lib/webcontainer';
import { selectedTeamSlugStore } from '~/lib/stores/convexTeams';
import { convexProjectStore } from '~/lib/stores/convexProject';
import { toast } from 'sonner';
import type { PartId } from '~/lib/stores/artifacts';
import { captureException } from '@sentry/remix';
import type { ActionStatus } from '~/lib/runtime/action-runner';
import { chatIdStore } from '~/lib/stores/chatId';
import type { ModelProvider } from '~/lib/.server/llm/convex-agent';
import { useConvex, useQuery } from 'convex/react';
import type { ConvexReactClient } from 'convex/react';
import { api } from '@convex/_generated/api';
import { disabledText, getTokenUsage, noTokensText } from '~/lib/convexUsage';
import { STATUS_MESSAGES } from './StreamingIndicator';

const logger = createScopedLogger('Chat');

const MAX_RETRIES = 3;

const CHEF_TOO_BUSY_ERROR =
  'Chef is too busy cooking right now. Please try again in a moment or enter your own API key at chef.convex.dev/settings.';
export const VITE_PROVISION_HOST = import.meta.env.VITE_PROVISION_HOST || 'https://api.convex.dev';

const processSampledMessages = createSampler(
  (options: {
    messages: Message[];
    initialMessages: Message[];
    parseMessages: (messages: Message[]) => void;
    storeMessageHistory: (messages: Message[]) => Promise<void>;
  }) => {
    const { messages, initialMessages, parseMessages, storeMessageHistory } = options;
    parseMessages(messages);

    if (messages.length > initialMessages.length) {
      storeMessageHistory(messages).catch((error) => toast.error(error.message));
    }
  },
  50,
);

interface ChatProps {
  initialMessages: Message[];
  partCache: PartCache;
  storeMessageHistory: (messages: Message[]) => Promise<void>;
  initializeChat: () => Promise<void>;
  description?: string;

  isReload: boolean;
  hadSuccessfulDeploy: boolean;
  initialInput?: string;
}

export const Chat = memo(
  ({
    initialMessages,
    partCache,
    storeMessageHistory,
    initializeChat,
    isReload,
    hadSuccessfulDeploy,
    initialInput,
  }: ChatProps) => {
    const convex = useConvex();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [imageDataList, setImageDataList] = useState<string[]>([]);
    const [searchParams, setSearchParams] = useSearchParams();
    const actionAlert = useStore(workbenchStore.alert);

    const title = useStore(description);

    const { showChat } = useStore(chatStore);

    const [animationScope, animate] = useAnimate();

    const apiKey = useQuery(api.apiKeys.apiKeyForCurrentMember);

    const [modelSelection, setModelSelection] = useState<ModelSelection>('auto');

    const [retries, setRetries] = useState<{ numFailures: number; nextRetry: number; seed: number }>({
      numFailures: 0,
      nextRetry: Date.now(),
      seed: Math.random() < 0.5 ? 0 : 1,
    });

    // Reset retries counter every minute
    useEffect(() => {
      const resetInterval = setInterval(() => {
        setRetries((prev) => ({ ...prev, numFailures: 0, nextRetry: Date.now() }));
      }, 60 * 1000);

      return () => clearInterval(resetInterval);
    }, []);

    const chatContextManager = useRef(new ChatContextManager());
    const [disableChatMessage, setDisableChatMessage] = useState<string | null>(null);
    const [sendMessageInProgress, setSendMessageInProgress] = useState(false);

    function hasApiKeySet() {
      const useAnthropic = modelSelection === 'claude-3.5-sonnet' || modelSelection === 'auto';
      const useOpenai = modelSelection === 'gpt-4.1';
      if (useAnthropic && apiKey && apiKey.value) {
        return true;
      }
      if (useOpenai && apiKey && apiKey.openai) {
        return true;
      }
      return false;
    }

    async function checkTokenUsage() {
      if (hasApiKeySet()) {
        return;
      }

      const teamSlug = selectedTeamSlugStore.get();
      if (!teamSlug) {
        console.error('No team slug');
        throw new Error('No team slug');
      }
      const token = getConvexAuthToken(convex);
      if (!token) {
        console.error('No token');
        throw new Error('No token');
      }

      const tokenUsage = await getTokenUsage(VITE_PROVISION_HOST, token, teamSlug);
      if (tokenUsage.status === 'error') {
        console.error('Failed to check for token usage', tokenUsage.httpStatus, tokenUsage.httpBody);
      } else {
        if (tokenUsage.tokensQuota === 50000000) {
          // TODO(nipunn) Hack for launch day
          tokenUsage.tokensQuota = tokenUsage.tokensQuota * 10000;
        }
        const { tokensUsed, tokensQuota, isTeamDisabled } = tokenUsage;
        if (tokensUsed !== undefined && tokensQuota !== undefined) {
          console.log(`Convex tokens used/quota: ${tokensUsed} / ${tokensQuota}`);
          if (isTeamDisabled) {
            setDisableChatMessage(disabledText);
          } else if (tokensUsed > tokensQuota) {
            setDisableChatMessage(noTokensText(tokensUsed, tokensQuota));
          } else {
            setDisableChatMessage(null);
          }
        }
      }
    }

    const { messages, status, input, handleInputChange, setInput, stop, append, setMessages, reload, error } = useChat({
      initialMessages,
      initialInput: Cookies.get(PROMPT_COOKIE_KEY) || initialInput || '',
      api: '/api/chat',
      sendExtraMessageFields: true,
      experimental_prepareRequestBody: ({ messages }) => {
        const chatId = chatIdStore.get();
        const deploymentName = convexProjectStore.get()?.deploymentName;
        const teamSlug = selectedTeamSlugStore.get();
        const token = getConvexAuthToken(convex);
        if (!token) {
          throw new Error('No token');
        }
        if (!teamSlug) {
          throw new Error('No team slug');
        }
        let modelProvider: ModelProvider;
        if (modelSelection === 'auto' || modelSelection === 'claude-3.5-sonnet') {
          const providers: ModelProvider[] = ['Anthropic', 'Bedrock'];
          modelProvider = providers[(retries.seed + retries.numFailures) % providers.length];
        } else {
          modelProvider = 'OpenAI';
        }
        return {
          messages: chatContextManager.current.prepareContext(messages),
          firstUserMessage: messages.filter((message) => message.role == 'user').length == 1,
          chatId,
          token,
          teamSlug,
          deploymentName,
          modelProvider,
          // Fall back to the user's API key if the request has failed too many times
          userApiKey: retries.numFailures < MAX_RETRIES ? apiKey : { ...apiKey, preference: 'always' },
        };
      },
      maxSteps: 64,
      async onToolCall({ toolCall }) {
        console.log('Starting tool call', toolCall);
        const result = await workbenchStore.waitOnToolCall(toolCall.toolCallId);
        console.log('Tool call finished', result);
        return result;
      },
      onError: async (e: Error) => {
        // Clean up the last message if it's an assistant message
        setMessages((prevMessages) => {
          const updatedMessages = [...prevMessages];
          const lastMessage = updatedMessages[updatedMessages.length - 1];

          if (lastMessage?.role === 'assistant' && Array.isArray(lastMessage.parts)) {
            const updatedParts = [...lastMessage.parts.slice(0, -1)];
            if (updatedParts.length > 0) {
              updatedMessages[updatedMessages.length - 1] = {
                ...lastMessage,
                parts: updatedParts,
              };
            } else {
              updatedMessages.pop();
            }
          }

          return updatedMessages;
        });
        captureException('Failed to process chat request: ' + e.message, {
          level: 'error',
          extra: {
            error: e,
            userHasOwnApiKey: !!apiKey,
          },
        });
        logger.error('Request failed\n\n', e, error);
        setRetries((prevRetries) => {
          const newRetries = prevRetries.numFailures + 1;
          const backoff = error?.message.includes(STATUS_MESSAGES.error) ? exponentialBackoff(newRetries) : 0;
          return { ...prevRetries, numFailures: newRetries, nextRetry: Date.now() + backoff };
        });

        await checkTokenUsage();
      },
      onFinish: async (message, response) => {
        const usage = response.usage;
        if (usage) {
          console.debug('Token usage in response:', usage);
        }
        if (response.finishReason == 'stop') {
          setRetries((prev) => ({ ...prev, numFailures: 0, nextRetry: Date.now() }));
        }
        logger.debug('Finished streaming');

        await checkTokenUsage();
      },
    });

    useEffect(() => {
      const prompt = searchParams.get('prompt');

      if (!prompt || prompt.trim() === '') {
        return;
      }

      setSearchParams({});
      runAnimation();

      // Wait for the WebContainer to fully finish booting before sending a message.
      webcontainer.then(() => {
        append({ role: 'user', content: prompt });
      });
    }, [searchParams]);

    const { parsedMessages, parseMessages } = useMessageParser(partCache);

    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

    useEffect(() => {
      chatStore.setKey('started', initialMessages.length > 0);
    }, []);

    useEffect(() => {
      processSampledMessages({
        messages,
        initialMessages,
        parseMessages,
        storeMessageHistory,
      });
    }, [messages, parseMessages]);

    const abort = () => {
      stop();
      chatStore.setKey('aborted', true);
      workbenchStore.abortAllActions();
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
        animate('#footer', { opacity: 0, display: 'none' }, { duration: 0.2 }),
      ]);

      chatStore.setKey('started', true);

      setChatStarted(true);
    };

    const sendMessage = async (messageInput?: string) => {
      if ((retries.numFailures >= MAX_RETRIES || Date.now() < retries.nextRetry) && !hasApiKeySet()) {
        toast.error(CHEF_TOO_BUSY_ERROR);
        captureException('User tried to send message but chef is too busy');
        return;
      }

      const messageContent = messageInput || input;

      if (!messageContent?.trim()) {
        return;
      }

      if (status === 'streaming' || status === 'submitted') {
        console.log('Aborting current message.');
        abort();
        return;
      }

      if (sendMessageInProgress) {
        console.log('sendMessage already in progress, returning.');
        return;
      }
      try {
        setSendMessageInProgress(true);

        await initializeChat();
        runAnimation();

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
      } finally {
        setSendMessageInProgress(false);
      }
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
        messageRef={messageRef}
        textareaRef={textareaRef}
        scrollRef={scrollRef}
        showChat={showChat}
        chatStarted={chatStarted}
        description={title}
        input={input}
        uploadedFiles={uploadedFiles}
        setUploadedFiles={setUploadedFiles}
        imageDataList={imageDataList}
        setImageDataList={setImageDataList}
        handleInputChange={(e) => {
          onTextareaChange(e);
          debouncedCachePrompt(e);
        }}
        handleStop={abort}
        sendMessage={sendMessage}
        streamStatus={status}
        currentError={error}
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
        actionAlert={actionAlert}
        clearAlert={() => workbenchStore.clearAlert()}
        terminalInitializationOptions={{
          isReload,
          shouldDeployConvexFunctions: hadSuccessfulDeploy,
        }}
        disableChatMessage={disableChatMessage}
        sendMessageInProgress={sendMessageInProgress}
        modelSelection={modelSelection}
        setModelSelection={setModelSelection}
      />
    );
  },
);
Chat.displayName = 'Chat';

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

function exponentialBackoff(numFailures: number) {
  const jitter = Math.random() + 0.5;
  const delay = 1000 * Math.pow(2, numFailures) * jitter;
  return delay;
}

/**
 * We send the auth token in big brain requests. The Convex client already makes
 * sure it has an up-to-date auth token, so we just need to extract it.
 *
 * This is especially convenient in functions that are not async.
 *
 * Since there's not a public API for this, we internally type cast.
 */
function getConvexAuthToken(convex: ConvexReactClient): string | null {
  const token = (convex as any)?.sync?.state?.auth?.value;
  if (!token) {
    return null;
  }
  return token;
}
