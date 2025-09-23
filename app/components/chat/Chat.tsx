import { useStore } from '@nanostores/react';
import type { Message, UIMessage } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useAnimate } from 'framer-motion';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMessageParser, type PartCache } from '~/lib/hooks/useMessageParser';
import { useSnapScroll } from '~/lib/hooks/useSnapScroll';
import { description } from '~/lib/stores/description';
import { chatStore } from '~/lib/stores/chatId';
import { workbenchStore } from '~/lib/stores/workbench.client';
import { MAX_CONSECUTIVE_DEPLOY_ERRORS, type ModelSelection } from '~/utils/constants';
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
import { ClipboardIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import type { Id } from 'convex/_generated/dataModel';
import { VITE_PROVISION_HOST } from '~/lib/convexProvisionHost';
import type { ProviderType } from '~/lib/common/annotations';
import { setChefDebugProperty } from 'chef-agent/utils/chefDebug';
import { MissingApiKey } from './MissingApiKey';
import { models, type ModelProvider } from '~/components/chat/ModelSelector';
import { useLaunchDarkly } from '~/lib/hooks/useLaunchDarkly';
import { useLocalStorage } from '@uidotdev/usehooks';
import { KeyIcon } from '@heroicons/react/24/outline';
import { UsageDebugView } from '~/components/debug/UsageDebugView';
import { useReferralCode, useReferralStats } from '~/lib/hooks/useReferralCode';
import { useUsage } from '~/lib/stores/usage';
import { hasAnyApiKeySet, hasApiKeySet } from '~/lib/common/apiKey';
import { chatSyncState } from '~/lib/stores/startup/chatSyncState';
import { customSystemPromptStore } from '~/lib/stores/customSystemPrompt';

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

    if (messages.length >= initialMessages.length) {
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
  initializeChat: () => Promise<boolean>;
  description?: string;

  isReload: boolean;
  hadSuccessfulDeploy: boolean;
  subchats?: { subchatIndex: number; updatedAt: number; description?: string }[];
}

const retryState = atom({
  numFailures: 0,
  nextRetry: Date.now(),
});
export const Chat = memo(
  ({
    initialMessages,
    partCache,
    storeMessageHistory,
    initializeChat,
    isReload,
    hadSuccessfulDeploy,
    subchats,
  }: ChatProps) => {
    const convex = useConvex();
    const sessionId = useConvexSessionIdOrNullOrLoading();
    const [chatStarted, setChatStarted] = useState(initialMessages.length > 0 || (!!subchats && subchats.length > 1));
    const actionAlert = useStore(workbenchStore.alert);
    const syncState = useStore(chatSyncState);

    const rewindToMessage = async (subchatIndex?: number, messageIndex?: number) => {
      if (sessionId && typeof sessionId === 'string') {
        const chatId = chatIdStore.get();
        if (!chatId) {
          return;
        }
        if (subchatIndex === undefined) {
          return;
        }

        const url = new URL(window.location.href);
        url.searchParams.set('rewind', 'true');

        try {
          await convex.mutation(api.messages.rewindChat, {
            sessionId: sessionId as Id<'sessions'>,
            chatId,
            subchatIndex,
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
    const {
      recordRawPromptsForDebugging,
      maxCollapsedMessagesSize,
      maxRelevantFilesSize,
      minCollapsedMessagesSize,
      useGeminiAuto,
      enableResend,
      useAnthropicFraction,
    } = useLaunchDarkly();

    const title = useStore(description);

    const { showChat } = useStore(chatStore);

    const [animationScope, animate] = useAnimate();

    const apiKey = useQuery(api.apiKeys.apiKeyForCurrentMember);

    const [modelSelection, setModelSelection] = useLocalStorage<ModelSelection>('modelSelection', 'auto');
    const terminalInitializationOptions = useMemo(
      () => ({
        isReload,
        shouldDeployConvexFunctions: hadSuccessfulDeploy || (!!subchats && subchats.length > 1),
      }),
      [isReload, hadSuccessfulDeploy, subchats],
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

    const checkApiKeyForCurrentModel = useCallback(
      (model: ModelSelection): { hasMissingKey: boolean; provider?: ModelProvider; requireKey: boolean } => {
        const requireKey = models[model]?.requireKey || false;
        if (apiKey?.preference !== 'always' && !requireKey) {
          return { hasMissingKey: false, requireKey: false };
        }

        // Map models to their respective providers
        const MODEL_TO_PROVIDER_MAP: {
          [K in ModelSelection]: { providerName: ModelProvider; apiKeyField: 'value' | 'openai' | 'xai' | 'google' };
        } = {
          auto: { providerName: 'anthropic', apiKeyField: 'value' },
          'claude-4-sonnet': { providerName: 'anthropic', apiKeyField: 'value' },
          'gpt-4.1': { providerName: 'openai', apiKeyField: 'openai' },
          'gpt-5': { providerName: 'openai', apiKeyField: 'openai' },
          'grok-3-mini': { providerName: 'xai', apiKeyField: 'xai' },
          'gemini-2.5-pro': { providerName: 'google', apiKeyField: 'google' },
          'claude-3-5-haiku': { providerName: 'anthropic', apiKeyField: 'value' },
          'gpt-4.1-mini': { providerName: 'openai', apiKeyField: 'openai' },
        };

        // Get provider info for the current model
        const providerInfo = MODEL_TO_PROVIDER_MAP[model];

        // Check if the API key for this provider is missing
        const keyValue = apiKey?.[providerInfo.apiKeyField];
        if (!keyValue || keyValue.trim() === '') {
          return { hasMissingKey: true, provider: providerInfo.providerName, requireKey };
        }

        return { hasMissingKey: false, requireKey };
      },
      [apiKey],
    );

    const [_disableChatMessage, setDisableChatMessage] = useState<
      | { type: 'ExceededQuota' }
      | { type: 'TeamDisabled'; isPaidPlan: boolean }
      | { type: 'MissingApiKey'; provider: ModelProvider; requireKey: boolean }
      | null
    >(null);
    const teamSlug = useSelectedTeamSlug();
    const usage = useUsage({ teamSlug });
    const forceDisable = usage && !usage.isLoadingUsage && !usage.isPaidPlan && usage.usagePercentage > 200;
    // Normally set manually, but you can force it by going way over quota (useful simulating this state)
    const disableChatMessage = forceDisable ? { type: 'ExceededQuota' as const } : _disableChatMessage;

    const [sendMessageInProgress, setSendMessageInProgress] = useState(false);

    const anthropicProviders: ProviderType[] =
      Math.random() < useAnthropicFraction ? ['Anthropic', 'Bedrock'] : ['Bedrock', 'Anthropic'];

    const checkTokenUsage = useCallback(async () => {
      if (hasApiKeySet(modelSelection, useGeminiAuto, apiKey)) {
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
    }, [apiKey, convex, modelSelection, setDisableChatMessage, useGeminiAuto]);

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
        let modelChoice: string | undefined = undefined;
        if (modelSelection === 'auto') {
          const providers: ProviderType[] = anthropicProviders;
          modelProvider = providers[retries.numFailures % providers.length];
          modelChoice = 'claude-sonnet-4-0';
        } else if (modelSelection === 'claude-3-5-haiku') {
          modelProvider = 'Anthropic';
          modelChoice = 'claude-3-5-haiku-latest';
        } else if (modelSelection === 'claude-4-sonnet') {
          const providers: ProviderType[] = anthropicProviders;
          modelProvider = providers[retries.numFailures % providers.length];
          modelChoice = 'claude-sonnet-4-0';
        } else if (modelSelection === 'grok-3-mini') {
          modelProvider = 'XAI';
        } else if (modelSelection === 'gemini-2.5-pro') {
          modelProvider = 'Google';
        } else if (modelSelection === 'gpt-4.1-mini') {
          modelProvider = 'OpenAI';
          modelChoice = 'gpt-4.1-mini';
        } else if (modelSelection === 'gpt-4.1') {
          modelProvider = 'OpenAI';
        } else if (modelSelection === 'gpt-5') {
          modelProvider = 'OpenAI';
          modelChoice = 'gpt-5';
        } else {
          const _exhaustiveCheck: never = modelSelection;
          throw new Error(`Unknown model: ${_exhaustiveCheck}`);
        }
        let shouldDisableTools = false;
        if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
          const lastSystemMessage = messages[messages.length - 1];
          const toolCalls = lastSystemMessage.parts.filter(
            (part) => part.type === 'tool-invocation' && part.toolInvocation.state === 'result',
          );
          if (toolCalls.length >= MAX_CONSECUTIVE_DEPLOY_ERRORS) {
            const lastToolCalls = toolCalls.slice(-MAX_CONSECUTIVE_DEPLOY_ERRORS);
            const allFailed = lastToolCalls.every(
              (t) =>
                t.type === 'tool-invocation' &&
                t.toolInvocation.state === 'result' &&
                t.toolInvocation.result.startsWith('Error:'),
            );
            if (allFailed) {
              shouldDisableTools = true;
            }
          }
        }
        const { messages: preparedMessages, collapsedMessages } = chatContextManager.current.prepareContext(
          messages,
          maxSizeForModel(modelSelection, maxCollapsedMessagesSize),
          minCollapsedMessagesSize,
        );

        const characterCounts = chatContextManager.current.calculatePromptCharacterCounts(preparedMessages);
        const customSystemPrompt = customSystemPromptStore.get();

        return {
          messages: preparedMessages,
          firstUserMessage: messages.filter((message) => message.role == 'user').length == 1,
          chatInitialId,
          token,
          teamSlug,
          deploymentName,
          modelProvider,
          // Fall back to the user's API key if the request has failed too many times
          userApiKey: retries.numFailures < MAX_RETRIES ? apiKey : { ...apiKey, preference: 'always' },
          shouldDisableTools,
          recordRawPromptsForDebugging,
          modelChoice,
          collapsedMessages,
          promptCharacterCounts: characterCounts,
          featureFlags: {
            enableResend,
          },
          customSystemPrompt,
        };
      },
      maxSteps: 64,
      async onToolCall({ toolCall }) {
        console.log('Starting tool call', toolCall);
        const { result } = await workbenchStore.waitOnToolCall(toolCall.toolCallId);
        console.log('Tool call finished', result);
        return result;
      },
      onError: async (e: Error) => {
        captureMessage('Failed to process chat request: ' + e.message, {
          level: 'error',
          extra: {
            error: e,
            userHasOwnApiKey: !!apiKey,
          },
        });

        const retries = retryState.get();
        logger.error(`Request failed (retries: ${JSON.stringify(retries)})`, e, error);

        const backoff = error?.message.includes(STATUS_MESSAGES.error)
          ? exponentialBackoff(retries.numFailures + 1)
          : 0;
        retryState.set({
          numFailures: retries.numFailures + 1,
          nextRetry: Date.now() + backoff,
        });

        workbenchStore.abortAllActions();
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

    // Reset chat messages when the loaded subchat index changes. We don't want to reset the
    // messages if `initialMessages` changes without a subchat index change.
    useEffect(() => {
      setMessages(initialMessages);
      // Reset chat context manager state when switching subchats to prevent stale indices
      chatContextManager.current.reset();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setMessages, syncState.subchatIndex]);

    setChefDebugProperty('messages', messages);

    // AKA "processed messages," since parsing has side effects
    const { parsedMessages, parseMessages } = useMessageParser(partCache);

    setChefDebugProperty('parsedMessages', parsedMessages);

    useEffect(() => {
      chatStore.setKey('started', messages.length > 0 || (!!subchats && subchats.length > 1));
    }, [messages.length, subchats]);

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
      if (
        (retries.numFailures >= MAX_RETRIES || now < retries.nextRetry) &&
        !hasApiKeySet(modelSelection, useGeminiAuto, apiKey)
      ) {
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

        const chatInitialized = await initializeChat();
        if (!chatInitialized) {
          return;
        }

        runAnimation();

        const shouldSendRelevantFiles = chatContextManager.current.shouldSendRelevantFiles(
          messages,
          maxSizeForModel(modelSelection, maxCollapsedMessagesSize),
        );
        const maybeRelevantFilesMessage: UIMessage = shouldSendRelevantFiles
          ? chatContextManager.current.relevantFiles(messages, `${Date.now()}`, maxRelevantFilesSize)
          : {
              id: `${Date.now()}`,
              content: '',
              role: 'user',
              parts: [],
            };

        // Make a clone of the relevantFilesMessage so we can inject the modified message after relevant files before the messageInput later
        const newMessage = structuredClone(maybeRelevantFilesMessage);
        newMessage.parts.push({
          type: 'text',
          text: messageInput,
        });
        newMessage.content = messageInput;
        if (!chatStarted) {
          setMessages([newMessage]);
          reload();
          return;
        }

        const modifiedFiles = workbenchStore.getModifiedFiles();
        chatStore.setKey('aborted', false);
        if (modifiedFiles !== undefined) {
          const userUpdateArtifact = filesToArtifacts(modifiedFiles, `${Date.now()}`);
          maybeRelevantFilesMessage.parts.push({
            type: 'text',
            text: userUpdateArtifact,
          });
          workbenchStore.resetAllFileModifications();
        }
        maybeRelevantFilesMessage.content = messageInput;
        maybeRelevantFilesMessage.parts.push({
          type: 'text',
          text: messageInput,
        });
        append(maybeRelevantFilesMessage);
      } finally {
        setSendMessageInProgress(false);
      }
    };

    const { messageRef, scrollRef, enableAutoScroll } = useSnapScroll();

    const handleModelSelectionChange = useCallback(
      async (newModel: ModelSelection) => {
        setModelSelection(newModel);

        // First check if we have a key for this model, which is the most important case
        if (hasApiKeySet(newModel, useGeminiAuto, apiKey)) {
          // If we have a key for this model, clear the message and exit early
          setDisableChatMessage(null);
          return;
        }

        const { hasMissingKey, provider, requireKey } = checkApiKeyForCurrentModel(newModel);

        if (hasMissingKey && provider) {
          // If the model requires a key that's not set, show the message
          setDisableChatMessage({ type: 'MissingApiKey', provider, requireKey });
        } else {
          // For other cases (like free tier or no key required), check full token usage
          await checkTokenUsage().catch((error) => {
            console.error('Error checking token usage after model change:', error);
          });
        }
      },
      [apiKey, checkApiKeyForCurrentModel, checkTokenUsage, setModelSelection, useGeminiAuto],
    );

    return (
      <>
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
                requireKey={disableChatMessage.requireKey}
                resetDisableChatMessage={() => setDisableChatMessage(null)}
              />
            ) : null
          }
          sendMessageInProgress={sendMessageInProgress}
          modelSelection={modelSelection}
          setModelSelection={handleModelSelectionChange}
          onRewindToMessage={rewindToMessage}
          subchats={subchats}
        />
        <UsageDebugView />
      </>
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
  const referralCode = useReferralCode();
  const referralStats = useReferralStats();

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <h4>You&apos;ve used all the tokens included with your free plan.</h4>
      <div className="flex flex-wrap items-center gap-2">
        <TeamSelector
          selectedTeamSlug={selectedTeamSlug}
          setSelectedTeamSlug={(slug) => {
            setSelectedTeamSlug(slug);
            resetDisableChatMessage();
          }}
        />
        <Button href="/settings" icon={<KeyIcon className="size-4" />} variant="neutral">
          Add your own API key
        </Button>
        <Button
          href={
            selectedTeamSlug
              ? `https://dashboard.convex.dev/t/${selectedTeamSlug}/settings/billing?source=chef`
              : 'https://dashboard.convex.dev/team/settings/billing?source=chef'
          }
          className="w-fit"
          icon={<ExternalLinkIcon />}
        >
          Upgrade to a paid plan
        </Button>
        {referralCode && referralStats?.left !== 0 && (
          <div className="w-full space-y-2">
            <p className="text-sm text-content-secondary">
              Refer a friend and Get 85,000 free Chef tokens for each
              {referralStats?.left === 5 || !referralStats ? ' (limit 5)' : ` (${referralStats.left} / 5)`}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={`https://convex.dev/try-chef/${referralCode}`}
                className="flex-1 rounded-md border bg-bolt-elements-background-depth-2 px-3 py-1.5 text-sm text-content-primary"
              />
              <Button
                variant="neutral"
                size="xs"
                onClick={() => copyToClipboard(`https://convex.dev/try-chef/${referralCode}`)}
                tip="Copy link"
                icon={<ClipboardIcon />}
              />
            </div>
          </div>
        )}
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
        <TeamSelector
          selectedTeamSlug={selectedTeamSlug}
          setSelectedTeamSlug={(slug) => {
            setSelectedTeamSlug(slug);
            resetDisableChatMessage();
          }}
        />
        <Button
          href={
            selectedTeamSlug
              ? `https://dashboard.convex.dev/t/${selectedTeamSlug}/settings/billing?source=chef`
              : 'https://dashboard.convex.dev/team/settings/billing?source=chef'
          }
          className="w-fit"
          icon={<ExternalLinkIcon />}
        >
          {isPaidPlan ? 'Increase spending limit' : 'Upgrade your plan'}
        </Button>
        {isPaidPlan && <span>or wait until limits reset</span>}
      </div>
    </div>
  );
}

function maxSizeForModel(modelSelection: ModelSelection, maxSize: number) {
  switch (modelSelection) {
    case 'auto':
    case 'gemini-2.5-pro':
      return maxSize;
    default:
      // For non-anthropic models not yet using caching, use a lower message size limit.
      return 8192;
  }
}
