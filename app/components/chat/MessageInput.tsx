import Cookies from 'js-cookie';
import { useStore } from '@nanostores/react';
import { SendButton } from './SendButton.client';
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
import { setSelectedTeamSlug, useSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { useChefAuth } from './ChefAuthWrapper';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import { KeyboardShortcut } from '@ui/KeyboardShortcut';
import { openSignInWindow } from '~/components/ChefSignInPage';
import { Button } from '@ui/Button';
import { Spinner } from '@ui/Spinner';
import { debounce } from '~/utils/debounce';

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
  const TEXTAREA_MIN_HEIGHT = 76;
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

  return (
    <div className="z-prompt relative mx-auto w-full max-w-chat rounded-lg border bg-background-primary/75 backdrop-blur-md transition-all duration-200 has-[textarea:focus]:border-border-selected">
      <div>
        <textarea
          ref={textareaRef}
          className={classNames(
            'w-full pl-4 pt-4 pr-16 pb-2 outline-none resize-none text-content-primary placeholder-content-tertiary bg-transparent text-sm',
            'focus:outline-none',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          value={input}
          onChange={handleChange}
          style={textareaStyle}
          placeholder={chatStarted ? 'Request changes by sending another message…' : 'What app do you want to serve?'}
          translate="no"
        />
        <SendButton
          show={input.length > 0 || isStreaming || sendMessageInProgress}
          isStreaming={isStreaming}
          disabled={!selectedTeamSlug || chefAuthState.kind === 'loading' || sendMessageInProgress || disabled}
          onClick={handleClickButton}
          tip={
            chefAuthState.kind === 'unauthenticated'
              ? 'Please sign in to continue'
              : !selectedTeamSlug
                ? 'Please select a team to continue'
                : undefined
          }
        />
        <div className="flex items-center justify-end gap-4 px-4 pb-3 text-sm">
          <ModelSelector modelSelection={modelSelection} setModelSelection={setModelSelection} />
          <div className="grow" />
          {input.length > 3 && <NewLineShortcut />}
          {chatStarted && <ConvexConnection />}
          {chefAuthState.kind === 'unauthenticated' && <SignInButton />}
          {!chatStarted && sessionId && (
            <TeamSelector
              description="Your project will be created in this Convex team"
              selectedTeamSlug={selectedTeamSlug}
              setSelectedTeamSlug={setSelectedTeamSlug}
            />
          )}
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

const SignInButton = memo(function SignInButton() {
  const [started, setStarted] = useState(false);
  const signIn = useCallback(() => {
    setStarted(true);
    openSignInWindow();
  }, [setStarted]);
  return (
    <Button variant="neutral" onClick={signIn}>
      {!started && (
        <>
          <img className="size-4" height="16" width="16" src="/icons/Convex.svg" alt="Convex" />
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
