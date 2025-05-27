import Cookies from 'js-cookie';
import { useStore } from '@nanostores/react';
import { EnhancePromptButton } from './EnhancePromptButton.client';
import { messageInputStore } from '~/lib/stores/messageInput';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEventHandler,
  type KeyboardEventHandler,
} from 'react';
import { useSearchParams } from '@remix-run/react';
import { classNames } from '~/utils/classNames';
import { ConvexConnection } from '~/components/convex/ConvexConnection';
import { PROMPT_COOKIE_KEY, type ModelSelection } from '~/utils/constants';
import { ModelSelector } from './ModelSelector';
import { TeamSelector } from '~/components/convex/TeamSelector';
import { ArrowRightIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, StopIcon } from '@radix-ui/react-icons';
import { SquaresPlusIcon } from '@heroicons/react/24/outline';
import { Tooltip } from '@ui/Tooltip';
import { setSelectedTeamSlug, useSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { useChefAuth } from './ChefAuthWrapper';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import { KeyboardShortcut } from '@ui/KeyboardShortcut';
import { openSignInWindow } from '~/components/ChefSignInPage';
import { Button } from '@ui/Button';
import { Spinner } from '@ui/Spinner';
import { debounce } from '~/utils/debounce';
import { toast } from 'sonner';
import { captureException } from '@sentry/remix';
import { Menu as MenuComponent, MenuItem as MenuItemComponent } from '@ui/Menu';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { ChatBubbleLeftIcon, DocumentArrowUpIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

const PROMPT_LENGTH_WARNING_THRESHOLD = 2000;

export const MessageInput = memo(function MessageInput({
  chatStarted,
  isStreaming,
  sendMessageInProgress,
  onStop,
  onSend,
  disabled,
  modelSelection,
  setModelSelection,
}: {
  chatStarted: boolean;
  isStreaming: boolean;
  sendMessageInProgress: boolean;
  onStop: () => void;
  onSend: (message: string) => Promise<void>;
  disabled: boolean;
  modelSelection: ModelSelection;
  setModelSelection: (modelSelection: ModelSelection) => void;
}) {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const chefAuthState = useChefAuth();
  const selectedTeamSlug = useSelectedTeamSlug();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const input = useStore(messageInputStore);

  // Set the initial input value
  const [searchParams] = useSearchParams();
  useEffect(() => {
    messageInputStore.set(searchParams.get('prefill') || Cookies.get(PROMPT_COOKIE_KEY) || '');
  }, [searchParams]);

  // Textarea auto-sizing
  const TEXTAREA_MIN_HEIGHT = 100;
  const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;
  useEffect(() => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.style.height = 'auto';

      const scrollHeight = textarea.scrollHeight;

      textarea.style.height = `${Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
      textarea.style.overflowY = scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
    }
  }, [input, textareaRef, TEXTAREA_MAX_HEIGHT]);
  const textareaStyle = useMemo(
    () => ({
      minHeight: TEXTAREA_MIN_HEIGHT,
      maxHeight: TEXTAREA_MAX_HEIGHT,
    }),
    [TEXTAREA_MAX_HEIGHT],
  );

  // Send messages
  const handleSend = useCallback(async () => {
    const trimmedInput = input.trim();
    if (trimmedInput.length === 0) {
      return;
    }

    await onSend(trimmedInput);

    Cookies.remove(PROMPT_COOKIE_KEY);
    messageInputStore.set('');
    textareaRef.current?.blur();
  }, [input, onSend]);

  const handleClickButton = useCallback(() => {
    if (isStreaming) {
      onStop?.();
      return;
    }

    handleSend();
  }, [handleSend, isStreaming, onStop]);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      if (event.key === 'Enter' && selectedTeamSlug) {
        if (event.shiftKey) {
          return;
        }

        event.preventDefault();

        if (isStreaming) {
          onStop?.();
          return;
        }

        // ignore if using input method engine
        if (event.nativeEvent.isComposing) {
          return;
        }

        handleSend();
      }
    },
    [selectedTeamSlug, handleSend, isStreaming, onStop],
  );

  const handleChange: ChangeEventHandler<HTMLTextAreaElement> = useCallback((event) => {
    const value = event.target.value;
    messageInputStore.set(value);
    cachePrompt(value);
  }, []);

  const enhancePrompt = useCallback(async () => {
    try {
      setIsEnhancing(true);

      const response = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: input.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to enhance prompt');
      }

      const data = await response.json();
      if (data.enhancedPrompt) {
        messageInputStore.set(data.enhancedPrompt);
      }
    } catch (error) {
      captureException('Failed to enhance prompt', {
        level: 'error',
        extra: {
          error,
        },
      });
      toast.error('Failed to enhance prompt. Please try again.');
    } finally {
      setIsEnhancing(false);
    }
  }, [input]);

  // Helper to insert template and select '[...]'
  const insertTemplate = useCallback(
    (template: string) => {
      let newValue;
      if (input && input.trim().length > 0) {
        newValue = input + (input.endsWith('\n') ? '' : '\n\n') + template;
      } else {
        newValue = template;
      }
      messageInputStore.set(newValue);
      setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          const start = newValue.lastIndexOf('...');
          if (start !== -1) {
            textarea.focus();
            textarea.setSelectionRange(start, start + 5);
          }
        }
      }, 0);
    },
    [input],
  );

  return (
    <div className="relative z-20 mx-auto w-full max-w-chat rounded-xl shadow transition-all duration-200">
      <div className="rounded-xl bg-background-primary/75 backdrop-blur-md">
        <div
          className={classNames(
            'pt-2 pr-1 rounded-t-xl transition-all',
            'border has-[textarea:focus]:border-border-selected',
          )}
        >
          <textarea
            ref={textareaRef}
            className={classNames(
              'w-full px-3 pt-1 outline-none resize-none text-content-primary placeholder-content-tertiary bg-transparent text-sm',
              'transition-all',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'scrollbar-thin scrollbar-thumb-macosScrollbar-thumb scrollbar-track-transparent',
            )}
            disabled={disabled}
            onKeyDown={handleKeyDown}
            value={input}
            onChange={handleChange}
            style={textareaStyle}
            placeholder={chatStarted ? 'Request changes by sending another message…' : 'What app do you want to serve?'}
            translate="no"
            // Disable Grammarly
            data-gramm="false"
          />
        </div>
        <div
          className={classNames(
            'flex items-center gap-2 border rounded-b-xl border-t-0 bg-background-secondary/80 p-1.5 text-sm flex-wrap',
          )}
        >
          {chefAuthState.kind === 'fullyLoggedIn' && (
            <ModelSelector modelSelection={modelSelection} setModelSelection={setModelSelection} size="sm" />
          )}
          {!chatStarted && sessionId && (
            <TeamSelector
              description="Your project will be created in this Convex team"
              selectedTeamSlug={selectedTeamSlug}
              setSelectedTeamSlug={setSelectedTeamSlug}
              size="sm"
            />
          )}
          {chatStarted && <ConvexConnection />}
          {input.length > 3 && input.length <= PROMPT_LENGTH_WARNING_THRESHOLD && <NewLineShortcut />}
          {input.length > PROMPT_LENGTH_WARNING_THRESHOLD && <CharacterWarning />}
          <div className="ml-auto flex items-center gap-1">
            {chefAuthState.kind === 'unauthenticated' && <SignInButton />}
            <MenuComponent
              buttonProps={{
                variant: 'neutral',
                tip: 'Use a recipe',
                inline: true,
                icon: (
                  <div className="text-lg">
                    <SquaresPlusIcon className="size-4" />
                  </div>
                ),
              }}
              placement="top-start"
            >
              <div className="ml-3 flex items-center gap-1">
                <h2 className="text-sm font-bold">Use a recipe</h2>
                <Tooltip tip="Recipes are Chef prompts that add powerful full-stack features to your app." side="top">
                  <span className="cursor-help text-content-tertiary">
                    <InformationCircleIcon className="size-4" />
                  </span>
                </Tooltip>
              </div>
              <MenuItemComponent action={() => insertTemplate('Make a collaborative text editor that ...')}>
                <div className="flex w-full items-center gap-2">
                  <PencilSquareIcon className="size-4 text-content-secondary" />
                  Make a collaborative text editor
                </div>
              </MenuItemComponent>
              <MenuItemComponent action={() => insertTemplate('Add AI chat to ...')}>
                <div className="flex w-full items-center gap-2">
                  <ChatBubbleLeftIcon className="size-4 text-content-secondary" />
                  Add AI chat
                </div>
              </MenuItemComponent>
              <MenuItemComponent action={() => insertTemplate('Add file uploads to ...')}>
                <div className="flex w-full items-center gap-2">
                  <DocumentArrowUpIcon className="size-4 text-content-secondary" />
                  Add file uploads
                </div>
              </MenuItemComponent>
              <MenuItemComponent action={() => insertTemplate('Add full text search to ...')}>
                <div className="flex w-full items-center gap-2">
                  <MagnifyingGlassIcon className="size-4 text-content-secondary" />
                  Add full text search
                </div>
              </MenuItemComponent>
            </MenuComponent>
            {chefAuthState.kind === 'fullyLoggedIn' && (
              <EnhancePromptButton
                isEnhancing={isEnhancing}
                disabled={!selectedTeamSlug || disabled || input.length === 0}
                onClick={enhancePrompt}
              />
            )}
            <Button
              disabled={
                (!isStreaming && input.length === 0) ||
                !selectedTeamSlug ||
                chefAuthState.kind === 'loading' ||
                sendMessageInProgress ||
                disabled
              }
              tip={
                chefAuthState.kind === 'unauthenticated'
                  ? 'Please sign in to continue'
                  : !selectedTeamSlug
                    ? 'Please select a team to continue'
                    : undefined
              }
              onClick={handleClickButton}
              size="xs"
              className="ml-2 h-[1.625rem]"
              aria-label={isStreaming ? 'Stop' : 'Send'}
              icon={!isStreaming ? <ArrowRightIcon /> : <StopIcon />}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

const NewLineShortcut = memo(function NewLineShortcut() {
  return (
    <div className="text-xs text-content-tertiary">
      <KeyboardShortcut value={['Shift', 'Return']} className="mr-0.5 font-semibold" /> for new line
    </div>
  );
});

const CharacterWarning = memo(function CharacterWarning() {
  return (
    <Tooltip
      tip="Chef performs better with shorter prompts. Consider making your prompt more concise or breaking it into smaller chunks."
      side="bottom"
    >
      <div className="flex cursor-help items-center text-xs text-content-warning">
        <ExclamationTriangleIcon className="mr-1 size-4" />
        Prompt exceeds {PROMPT_LENGTH_WARNING_THRESHOLD.toLocaleString()} characters
      </div>
    </Tooltip>
  );
});

const SignInButton = memo(function SignInButton() {
  const [started, setStarted] = useState(false);
  const signIn = useCallback(() => {
    setStarted(true);
    openSignInWindow();
  }, [setStarted]);
  return (
    <Button
      variant="neutral"
      onClick={signIn}
      size="xs"
      className="text-xs font-normal"
      icon={!started ? <img className="size-4" src="/icons/Convex.svg" alt="Convex" /> : undefined}
    >
      {!started && (
        <>
          <span>Sign in</span>
        </>
      )}
      {started && (
        <>
          <Spinner />
          Signing in…
        </>
      )}
    </Button>
  );
});

/**
 * Debounced function to cache the prompt in cookies.
 * Caches the trimmed value of the textarea input after a delay to optimize performance.
 */
const cachePrompt = debounce(function cachePrompt(prompt: string) {
  Cookies.set(PROMPT_COOKIE_KEY, prompt.trim(), { expires: 30 });
}, 1000);
