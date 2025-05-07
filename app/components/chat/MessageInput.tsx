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
import { ArrowRightIcon, ExclamationTriangleIcon, StopIcon } from '@radix-ui/react-icons';
import { Tooltip } from '@ui/Tooltip';
import { setSelectedTeamSlug, useSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { useChefAuth } from './ChefAuthWrapper';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import { KeyboardShortcut } from '@ui/KeyboardShortcut';
import { openSignInWindow } from '~/components/ChefSignInPage';
import { Button } from '@ui/Button';
import { Spinner } from '@ui/Spinner';
import { debounce } from '~/utils/debounce';

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
    if (!input.trim() || isEnhancing) return;
    
    try {
      setIsEnhancing(true);
      
      const response = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt: input.trim()
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
      console.error('Error enhancing prompt:', error);
    } finally {
      setIsEnhancing(false);
    }
  }, [input, isEnhancing]);

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
        {input.trim().length > 0 && (
          <EnhancePromptButton
            show={!isStreaming && !sendMessageInProgress}
            isEnhancing={isEnhancing}
            disabled={!selectedTeamSlug || chefAuthState.kind === 'loading' || disabled}
            onClick={enhancePrompt}
          />
        )}
        </div>
        <div
          className={classNames(
            'flex items-center gap-2 border rounded-b-xl border-t-0 bg-background-secondary/80 p-1.5 text-sm flex-wrap',
          )}
        >
          <ModelSelector modelSelection={modelSelection} setModelSelection={setModelSelection} size="sm" />
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
          <div className="ml-auto flex items-center gap-2">
            {chefAuthState.kind === 'unauthenticated' && <SignInButton />}
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
              className="h-[1.625rem]"
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
