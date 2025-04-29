import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useAnimate } from 'framer-motion';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMessageParser, type PartCache } from '~/lib/hooks/useMessageParser';
import { useSnapScroll } from '~/lib/hooks/useSnapScroll';
import { description } from '~/lib/stores/description';
import { chatStore } from '~/lib/stores/chatId';
import { workbenchStore } from '~/lib/stores/workbench.client';
import { type ModelSelection } from '~/utils/constants';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger } from 'chef-agent/utils/logger';
import { BaseChat } from './BaseChat.client';
import { createSampler } from '~/utils/sampler';
import { filesToArtifacts } from '~/utils/fileUtils';
import { ChatContextManager } from 'chef-agent/ChatContextManager';
import { selectedTeamSlugStore, setSelectedTeamSlug, useSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { convexProjectStore } from '~/lib/stores/convexProject';
import { toast } from 'sonner';
import type { PartId } from '~/lib/stores/artifacts';
import { captureException, captureMessage } from '@sentry/remix';
import type { ActionStatus } from '~/lib/runtime/action-runner';
import { chatIdStore, initialIdStore } from '~/lib/stores/chatId';
import { useConvex, useQuery } from 'convex/react';
import type { ConvexReactClient } from 'convex/react';
import { api } from '@convex/_generated/api';
import { getTokenUsage } from '~/lib/convexUsage';
import { formatDistanceStrict } from 'date-fns';
import { atom } from 'nanostores';
import { STATUS_MESSAGES } from './StreamingIndicator';
import { Button } from '@ui/Button';
import { TeamSelector } from '~/components/convex/TeamSelector';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import type { Doc, Id } from 'convex/_generated/dataModel';
import { useFlags } from 'launchdarkly-react-client-sdk';
import { VITE_PROVISION_HOST } from '~/lib/convexProvisionHost';
import type { ProviderType } from '~/lib/common/annotations';
import { setChefDebugProperty } from 'chef-agent/utils/chefDebug';
import { MissingApiKey } from './MissingApiKey';
import type { ModelProvider } from '~/components/chat/ModelSelector';

const logger = createScopedLogger('Chat');

const MAX_RETRIES = 4;

const processSampledMessages = createSampler(
  (options: {
    messages: Message[];
    initialMessages: Message[];
    parseMessages: (messages: Message[]) => void;
    streamStatus: 'streaming' | 'submitted' | 'ready' | 'error';
    storeMessageHistory: (
      messages: Message[],
      streamStatus: 'streaming' | 'submitted' | 'ready' | 'error',
    ) => Promise<void>;
  }) => {
    const { messages, initialMessages, parseMessages, storeMessageHistory, streamStatus } = options;
    parseMessages(messages);

    if (messages.length > initialMessages.length) {
      storeMessageHistory(messages, streamStatus).catch((error) => toast.error(error.message));
    }
  },
  50,
);

interface ChatProps {
  initialMessages: Message[];
  partCache: PartCache;
  storeMessageHistory: (
    messages: Message[],
    streamStatus: 'streaming' | 'submitted' | 'ready' | 'error',
  ) => Promise<void>;
  initializeChat: () => Promise<void>;
  description?: string;

  isReload: boolean;
  hadSuccessfulDeploy: boolean;
  earliestRewindableMessageRank?: number;
}

const retryState = atom({
  numFailures: 0,
  nextRetry: Date.now(),
});
const shouldDisableToolsStore = atom(false);
const skipSystemPromptStore = atom(false);
export const Chat = memo(
  ({
    initialMessages,
    partCache,
    storeMessageHistory,
    initializeChat,
    isReload,
    hadSuccessfulDeploy,
    earliestRewindableMessageRank,
  }: ChatProps) => {
    const convex = useConvex();
    const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);
    const actionAlert = useStore(workbenchStore.alert);
    const sessionId = useConvexSessionIdOrNullOrLoading();

    const rewindToMessage = async (messageIndex: number) => {
      if (sessionId && typeof sessionId === 'string') {
        const chatId = chatIdStore.get();
        if (!chatId) {
          return;
        }

        const url = new URL(window.location.href);
        url.searchParams.set('rewind', 'true');

        try {
          await convex.mutation(api.messages.rewindChat, {
            sessionId: sessionId as Id<'sessions'>,
            chatId,
            lastMessageRank: messageIndex,
          });
          // Reload the chat to show the rewound state
          window.location.replace(url.href);
        } catch (error) {
          console.error('Failed to rewind chat:', error);
          toast.error('Failed to rewind chat');
        }
      }
    };
    const { recordRawPromptsForDebugging } = useFlags();

    const title = useStore(description);

    const { showChat } = useStore(chatStore);

    const [animationScope, animate] = useAnimate();

    const apiKey = useQuery(api.apiKeys.apiKeyForCurrentMember);

    const [modelSelection, setModelSelection] = useState<ModelSelection>('auto');
    const terminalInitializationOptions = useMemo(
      () => ({
        isReload,
        shouldDeployConvexFunctions: hadSuccessfulDeploy,
      }),
      [isReload, hadSuccessfulDeploy],
    );

    useEffect(() => {
      const url = new URL(window.location.href);
      if (url.searchParams.get('rewind') === 'true') {
        toast.info('Successfully reverted changes. You may need to clear or migrate your Convex data.');
      }
    }, []);

    // Reset retries counter every minute
    useEffect(() => {
      const resetInterval = setInterval(() => {
        retryState.set({ numFailures: 0, nextRetry: Date.now() });
      }, 60 * 1000);
      return () => clearInterval(resetInterval);
    }, []);

    const chatContextManager = useRef(
      new ChatContextManager(
        () => workbenchStore.currentDocument.get(),
        () => workbenchStore.files.get(),
        () => workbenchStore.userWrites,
      ),
    );
    const [disableChatMessage, setDisableChatMessage] = useState<
      | { type: 'ExceededQuota' }
      | { type: 'TeamDisabled'; isPaidPlan: boolean }
      | { type: 'MissingApiKey'; provider: ModelProvider }
      | null
    >(null);
    const [sendMessageInProgress, setSendMessageInProgress] = useState(false);

    const checkApiKeyForCurrentModel = useCallback(
      (model: ModelSelection): { hasMissingKey: boolean; provider?: ModelProvider } => {
        if (apiKey?.preference !== 'always') {
          return { hasMissingKey: false };
        }

        // Map models to their respective providers
        const MODEL_TO_PROVIDER_MAP: {
          [K in ModelSelection]: { providerName: ModelProvider; apiKeyField: keyof typeof apiKey };
        } = {
          auto: { providerName: 'anthropic', apiKeyField: 'value' },
          'claude-3.5-sonnet': { providerName: 'anthropic', apiKeyField: 'value' },
          'gpt-4.1': { providerName: 'openai', apiKeyField: 'openai' },
          'grok-3-mini': { providerName: 'xai', apiKeyField: 'xai' },
          'gemini-2.5-pro': { providerName: 'google', apiKeyField: 'google' },
        };

        // Get provider info for the current model
        const providerInfo = MODEL_TO_PROVIDER_MAP[model];

        // Check if the API key for this provider is missing
        const keyValue = apiKey[providerInfo.apiKeyField];
        if (!keyValue || keyValue.trim() === '') {
          return { hasMissingKey: true, provider: providerInfo.providerName };
        }

        return { hasMissingKey: false };
      },
      [apiKey],
    );

    const checkTokenUsage = useCallback(async () => {
      // First, check if preference is 'always' but key for model is missing
      const { hasMissingKey, provider } = checkApiKeyForCurrentModel(modelSelection);
      if (hasMissingKey && provider) {
        setDisableChatMessage({ type: 'MissingApiKey', provider });
        return;
      }

      if (hasApiKeySet(modelSelection, apiKey)) {
        setDisableChatMessage(null);
        return;
      }

      try {
        const teamSlug = selectedTeamSlugStore.get();
        if (!teamSlug) {
          console.error('No team slug');
          return; // Just return instead of throwing
        }
        const token = getConvexAuthToken(convex);
        if (!token) {
          console.error('No token');
          return; // Just return instead of throwing
        }

        const tokenUsage = await getTokenUsage(VITE_PROVISION_HOST, token, teamSlug);
        if (tokenUsage.status === 'error') {
          console.error('Failed to check for token usage', tokenUsage.httpStatus, tokenUsage.httpBody);
        } else {
          const { centitokensUsed, centitokensQuota, isTeamDisabled, isPaidPlan } = tokenUsage;
          if (centitokensUsed !== undefined && centitokensQuota !== undefined) {
            console.log(`Convex tokens used/quota: ${centitokensUsed} / ${centitokensQuota}`);
            if (isTeamDisabled) {
              setDisableChatMessage({ type: 'TeamDisabled', isPaidPlan });
            } else if (!isPaidPlan && centitokensUsed > centitokensQuota && !hasAnyApiKeySet(apiKey)) {
              setDisableChatMessage({ type: 'ExceededQuota' });
            } else {
              setDisableChatMessage(null);
            }
          }
        }
      } catch (error) {
        captureException(error);
      }
    }, [apiKey, checkApiKeyForCurrentModel, convex, modelSelection, setDisableChatMessage]);

    const { enableSkipSystemPrompt, smallFiles } = useFlags();
    const { messages, status, stop, append, setMessages, reload, error } = useChat({
      initialMessages,
      api: '/api/chat',
      sendExtraMessageFields: true,
      experimental_prepareRequestBody: ({ messages }) => {
        const chatInitialId = initialIdStore.get();
        const deploymentName = convexProjectStore.get()?.deploymentName;
        const teamSlug = selectedTeamSlugStore.get();
        const token = getConvexAuthToken(convex);
        if (!token) {
          throw new Error('No token');
        }
        if (!teamSlug) {
          throw new Error('No team slug');
        }
        let modelProvider: ProviderType;
        const retries = retryState.get();
        if (modelSelection === 'auto' || modelSelection === 'claude-3.5-sonnet') {
          // Send all traffic to Anthropic first before failing over to Bedrock.
          const providers: ProviderType[] = ['Anthropic', 'Bedrock'];
          modelProvider = providers[retries.numFailures % providers.length];
        } else if (modelSelection === 'grok-3-mini') {
          modelProvider = 'XAI';
        } else if (modelSelection === 'gemini-2.5-pro') {
          modelProvider = 'Google';
        } else {
          modelProvider = 'OpenAI';
        }
        return {
          messages: chatContextManager.current.prepareContext(messages),
          firstUserMessage: messages.filter((message) => message.role == 'user').length == 1,
          chatInitialId,
          token,
          teamSlug,
          deploymentName,
          modelProvider,
          // Fall back to the user's API key if the request has failed too many times
          userApiKey: retries.numFailures < MAX_RETRIES ? apiKey : { ...apiKey, preference: 'always' },
          shouldDisableTools: shouldDisableToolsStore.get(),
          skipSystemPrompt: skipSystemPromptStore.get(),
          smallFiles,
          recordRawPromptsForDebugging,
        };
      },
      maxSteps: 64,
      async onToolCall({ toolCall }) {
        console.log('Starting tool call', toolCall);
        const { result, shouldDisableTools, skipSystemPrompt } = await workbenchStore.waitOnToolCall(
          toolCall.toolCallId,
        );
        console.log('Tool call finished', result);
        if (shouldDisableTools) {
          shouldDisableToolsStore.set(true);
        }
        if (skipSystemPrompt && enableSkipSystemPrompt) {
          skipSystemPromptStore.set(true);
        }
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
        captureMessage('Failed to process chat request: ' + e.message, {
          level: 'error',
          extra: {
            error: e,
            userHasOwnApiKey: !!apiKey,
          },
        });

        const retries = retryState.get();
        logger.error(`Request failed (retries: ${JSON.stringify(retries)})`, e, error);
        const isFirstFailure = retries.numFailures === 0;

        const backoff = error?.message.includes(STATUS_MESSAGES.error)
          ? exponentialBackoff(retries.numFailures + 1)
          : 0;
        retryState.set({
          numFailures: retries.numFailures + 1,
          nextRetry: Date.now() + backoff,
        });

        if (isFirstFailure && messages[messages.length - 1].role === 'user') {
          reload();
        }
        await checkTokenUsage();
      },
      onFinish: async (message, response) => {
        const usage = response.usage;
        if (usage) {
          console.debug('Token usage in response:', usage);
        }
        if (response.finishReason == 'stop') {
          retryState.set({ numFailures: 0, nextRetry: Date.now() });
        }
        logger.debug('Finished streaming');

        await checkTokenUsage();
      },
    });

    setChefDebugProperty('messages', messages);

    // AKA "processed messages," since parsing has side effects
    const { parsedMessages, parseMessages } = useMessageParser(partCache);

    setChefDebugProperty('parsedMessages', parsedMessages);

    useEffect(() => {
      chatStore.setKey('started', initialMessages.length > 0);
    }, [initialMessages.length]);

    useEffect(() => {
      processSampledMessages({
        messages,
        initialMessages,
        parseMessages,
        storeMessageHistory,
        streamStatus: status,
      });
    }, [initialMessages, messages, parseMessages, status, storeMessageHistory]);

    const abort = () => {
      stop();
      chatStore.setKey('aborted', true);
      workbenchStore.abortAllActions();
    };

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

    const sendMessage = async (messageInput: string) => {
      const now = Date.now();
      const retries = retryState.get();
      if ((retries.numFailures >= MAX_RETRIES || now < retries.nextRetry) && !hasApiKeySet(modelSelection, apiKey)) {
        let message: string | ReactNode = 'Chef is too busy cooking right now. ';
        if (retries.numFailures >= MAX_RETRIES) {
          message = (
            <>
              {message}
              Please{' '}
              <a href="https://chef.convex.dev/settings" className="text-content-link hover:underline">
                enter your own API key
              </a>
              .
            </>
          );
        } else {
          const remaining = formatDistanceStrict(now, retries.nextRetry);
          message = (
            <>
              {message}
              Please try again in {remaining} or{' '}
              <a href="https://chef.convex.dev/settings" className="text-content-link hover:underline">
                enter your own API key
              </a>
              .
            </>
          );
        }
        toast.error(message);
        captureMessage('User tried to send message but chef is too busy');
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

        enableAutoScroll();

        await initializeChat();
        runAnimation();

        if (!chatStarted) {
          setMessages([
            {
              id: `${new Date().getTime()}`,
              role: 'user',
              content: messageInput,
              parts: [
                {
                  type: 'text',
                  text: messageInput,
                },
              ],
            },
          ]);
          reload();
          return;
        }

        const modifiedFiles = workbenchStore.getModifiedFiles();
        chatStore.setKey('aborted', false);

        shouldDisableToolsStore.set(false);
        skipSystemPromptStore.set(false);
        if (modifiedFiles !== undefined) {
          const userUpdateArtifact = filesToArtifacts(modifiedFiles, `${Date.now()}`);
          append({
            role: 'user',
            content: messageInput,
            parts: [
              {
                type: 'text',
                text: `${userUpdateArtifact}${messageInput}`,
              },
            ],
          });

          workbenchStore.resetAllFileModifications();
        } else {
          append({
            role: 'user',
            content: messageInput,
            parts: [
              {
                type: 'text',
                text: messageInput,
              },
            ],
          });
        }
      } finally {
        setSendMessageInProgress(false);
      }
    };

    const { messageRef, scrollRef, enableAutoScroll } = useSnapScroll();

    const handleModelSelectionChange = useCallback(
      async (newModel: ModelSelection) => {
        setModelSelection(newModel);

        // First check if we have a key for this model, which is the most important case
        if (hasApiKeySet(newModel, apiKey)) {
          // If we have a key for this model, clear the message and exit early
          setDisableChatMessage(null);
          return;
        }

        const { hasMissingKey, provider } = checkApiKeyForCurrentModel(newModel);

        if (hasMissingKey && provider) {
          // If the model requires a key that's not set, show the message
          setDisableChatMessage({ type: 'MissingApiKey', provider });
        } else {
          // For other cases (like free tier or no key required), check full token usage
          await checkTokenUsage().catch((error) => {
            console.error('Error checking token usage after model change:', error);
          });
        }
      },
      [apiKey, checkApiKeyForCurrentModel, checkTokenUsage, setDisableChatMessage, setModelSelection],
    );

    return (
      <BaseChat
        ref={animationScope}
        messageRef={messageRef}
        scrollRef={scrollRef}
        showChat={showChat}
        chatStarted={chatStarted}
        description={title}
        onStop={abort}
        onSend={sendMessage}
        streamStatus={status}
        currentError={error}
        toolStatus={toolStatus}
        messages={parsedMessages /* Note that parsedMessages are throttled. */}
        actionAlert={actionAlert}
        clearAlert={() => workbenchStore.clearAlert()}
        terminalInitializationOptions={terminalInitializationOptions}
        disableChatMessage={
          disableChatMessage?.type === 'ExceededQuota' ? (
            <NoTokensText resetDisableChatMessage={() => setDisableChatMessage(null)} />
          ) : disableChatMessage?.type === 'TeamDisabled' ? (
            <DisabledText
              isPaidPlan={disableChatMessage.isPaidPlan}
              resetDisableChatMessage={() => setDisableChatMessage(null)}
            />
          ) : disableChatMessage?.type === 'MissingApiKey' ? (
            <MissingApiKey
              provider={disableChatMessage.provider}
              resetDisableChatMessage={() => setDisableChatMessage(null)}
              modelSelection={modelSelection}
              setModelSelection={handleModelSelectionChange}
            />
          ) : null
        }
        sendMessageInProgress={sendMessageInProgress}
        modelSelection={modelSelection}
        setModelSelection={handleModelSelectionChange}
        onRewindToMessage={rewindToMessage}
        earliestRewindableMessageRank={earliestRewindableMessageRank}
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

export function NoTokensText({ resetDisableChatMessage }: { resetDisableChatMessage: () => void }) {
  const selectedTeamSlug = useSelectedTeamSlug();
  return (
    <div className="flex w-full flex-col gap-4">
      <h3>You&apos;ve used all the tokens included with your free plan.</h3>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          href={
            selectedTeamSlug
              ? `https://dashboard.convex.dev/t/${selectedTeamSlug}/settings/billing`
              : 'https://dashboard.convex.dev/team/settings/billing'
          }
          className="w-fit"
          rel="noopener noreferrer"
          icon={<ExternalLinkIcon />}
        >
          Upgrade to a paid plan
        </Button>{' '}
        <span>
          or{' '}
          <a href="/settings" target="_blank" rel="noopener noreferrer" className="text-content-link hover:underline">
            add your own API key
          </a>{' '}
          to continue.
        </span>
      </div>
      <div className="ml-auto">
        <TeamSelector
          description="Your project will be created in this Convex team"
          selectedTeamSlug={selectedTeamSlug}
          setSelectedTeamSlug={(slug) => {
            setSelectedTeamSlug(slug);
            resetDisableChatMessage();
          }}
        />
      </div>
    </div>
  );
}

export function DisabledText({
  isPaidPlan,
  resetDisableChatMessage,
}: {
  isPaidPlan: boolean;
  resetDisableChatMessage: () => void;
}) {
  const selectedTeamSlug = useSelectedTeamSlug();
  return (
    <div className="flex w-full flex-col gap-4">
      <h3>
        {isPaidPlan
          ? "You've exceeded your spending limits, so your deployments have been disabled."
          : "You've exceeded the free plan limits, so your deployments have been disabled."}
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          href={
            selectedTeamSlug
              ? `https://dashboard.convex.dev/t/${selectedTeamSlug}/settings/billing`
              : 'https://dashboard.convex.dev/team/settings/billing'
          }
          className="w-fit"
          icon={<ExternalLinkIcon />}
          rel="noopener noreferrer"
        >
          {isPaidPlan ? 'Increase spending limit' : 'Upgrade to Pro'}
        </Button>
        {isPaidPlan && <span>or wait until limits reset</span>}
      </div>
      <div className="ml-auto">
        <TeamSelector
          description="Your project will be created in this Convex team"
          selectedTeamSlug={selectedTeamSlug}
          setSelectedTeamSlug={(slug) => {
            setSelectedTeamSlug(slug);
            resetDisableChatMessage();
          }}
        />
      </div>
    </div>
  );
}

function hasAnyApiKeySet(apiKey?: Doc<'convexMembers'>['apiKey'] | null) {
  if (!apiKey) {
    return false;
  }
  return Object.entries(apiKey).some(([key, value]) => {
    if (key === 'preference') {
      return false;
    }
    if (typeof value === 'string') {
      return value.trim() !== '';
    }
    return false;
  });
}

function hasApiKeySet(modelSelection: ModelSelection, apiKey?: Doc<'convexMembers'>['apiKey'] | null) {
  const useAnthropic = modelSelection === 'claude-3.5-sonnet' || modelSelection === 'auto';
  const useOpenai = modelSelection === 'gpt-4.1';
  const useXai = modelSelection === 'grok-3-mini';
  const useGoogle = modelSelection === 'gemini-2.5-pro';
  if (useAnthropic && apiKey && apiKey.value && apiKey.value.trim() !== '') {
    return true;
  }
  if (useOpenai && apiKey && apiKey.openai && apiKey.openai.trim() !== '') {
    return true;
  }
  if (useXai && apiKey && apiKey.xai && apiKey.xai.trim() !== '') {
    return true;
  }
  if (useGoogle && apiKey && apiKey.google && apiKey.google.trim() !== '') {
    return true;
  }
  return false;
}
