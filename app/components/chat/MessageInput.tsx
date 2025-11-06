import Cookies from 'js-cookie';
import { useStore } from '@nanostores/react';
import { EnhancePromptButton } from './EnhancePromptButton.client';
import { messageInputStore } from '~/lib/stores/messageInput';
import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
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
import { convexProjectStore } from '~/lib/stores/convexProject';
import { useChefAuth } from './ChefAuthWrapper';
import { getConvexAuthToken, useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import { KeyboardShortcut } from '@ui/KeyboardShortcut';
import { Button } from '@ui/Button';
import { Spinner } from '@ui/Spinner';
import { debounce } from '~/utils/debounce';
import { toast } from 'sonner';
import { captureException } from '@sentry/remix';
import { Menu as MenuComponent, MenuItem as MenuItemComponent } from '@ui/Menu';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import {
  AdjustmentsHorizontalIcon,
  ChatBubbleLeftIcon,
  DocumentArrowUpIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@workos-inc/authkit-react';
import { useConvex } from 'convex/react';
import { api } from '@convex/_generated/api';
import { customSystemPromptStore } from '~/lib/stores/customSystemPrompt';
import { chatIdStore } from '~/lib/stores/chatId';
import { Modal } from '@ui/Modal';

const PROMPT_LENGTH_WARNING_THRESHOLD = 2000;
const CUSTOM_SYSTEM_PROMPT_MAX_LENGTH = 2000;

type Highlight = {
  text: string; // must be lowercase
  tooltip: ReactNode;
};

const HIGHLIGHTS: Highlight[] = [
  {
    text: 'ai chat',
    tooltip: 'Unless otherwise configured, Chef will prototype with GPT‑4o mini or GPT‑4.1 nano (limits apply).',
  },
  {
    text: 'collaborative text editor',
    tooltip: (
      <>
        Chef will use the{' '}
        <TooltipLink href="https://www.convex.dev/components/prosemirror-sync">Collaborative Text Editor</TooltipLink>{' '}
        Convex <TooltipLink href="https://www.convex.dev/components">component</TooltipLink>.
      </>
    ),
  },
  {
    text: 'upload',
    tooltip: (
      <>
        Chef will use Convex’s built-in{' '}
        <TooltipLink href="https://docs.convex.dev/file-storage">file upload capabilities</TooltipLink>.
      </>
    ),
  },
  {
    text: 'full text search',
    tooltip: (
      <>
        Chef will use Convex’s built-in{' '}
        <TooltipLink href="https://docs.convex.dev/search/text-search">full text search</TooltipLink> capabilities.
      </>
    ),
  },
  {
    text: 'presence',
    tooltip: (
      <>
        Chef will use the <TooltipLink href="https://www.convex.dev/components/presence">Presence</TooltipLink>{' '}
        Convex&nbsp;<TooltipLink href="https://www.convex.dev/components">component</TooltipLink>.
      </>
    ),
  },
];

export const MessageInput = memo(function MessageInput({
  chatStarted,
  isStreaming,
  sendMessageInProgress,
  onStop,
  onSend,
  disabled,
  modelSelection,
  setModelSelection,
  numMessages,
}: {
  chatStarted: boolean;
  isStreaming: boolean;
  sendMessageInProgress: boolean;
  onStop: () => void;
  onSend: (message: string) => Promise<void>;
  disabled: boolean;
  modelSelection: ModelSelection;
  setModelSelection: (modelSelection: ModelSelection) => void;
  numMessages: number | undefined;
}) {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const chefAuthState = useChefAuth();
  const selectedTeamSlug = useSelectedTeamSlug();
  const convex = useConvex();
  const customSystemPrompt = useStore(customSystemPromptStore);
  const chatId = useStore(chatIdStore);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const input = useStore(messageInputStore);

  const [isCustomPromptModalOpen, setIsCustomPromptModalOpen] = useState(false);
  const [customPromptDraft, setCustomPromptDraft] = useState('');
  const [isSavingCustomPrompt, setIsSavingCustomPrompt] = useState(false);

  useEffect(() => {
    if (!isCustomPromptModalOpen) {
      setCustomPromptDraft(customSystemPrompt ?? '');
    }
  }, [customSystemPrompt, isCustomPromptModalOpen]);

  const customPromptLength = customPromptDraft.length;
  const isCustomPromptTooLong = customPromptLength > CUSTOM_SYSTEM_PROMPT_MAX_LENGTH;
  const hasCustomPrompt = !!customSystemPrompt && customSystemPrompt.trim().length > 0;
  const customPromptButtonDisabled = !sessionId || !chatId;

  const openCustomPromptModal = useCallback(() => {
    setCustomPromptDraft(customSystemPrompt ?? '');
    setIsCustomPromptModalOpen(true);
  }, [customSystemPrompt]);

  const closeCustomPromptModal = useCallback(() => {
    setIsCustomPromptModalOpen(false);
    setCustomPromptDraft(customSystemPrompt ?? '');
  }, [customSystemPrompt]);

  const handleCustomPromptChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCustomPromptDraft(event.target.value);
  }, []);

  const handleSaveCustomPrompt = useCallback(async () => {
    if (isCustomPromptTooLong) {
      toast.error(`Custom instructions must be ${CUSTOM_SYSTEM_PROMPT_MAX_LENGTH} characters or fewer.`);
      return;
    }
    if (!chatId) {
      toast.error('Chat Id is not available');
      return;
    }
    if (!sessionId) {
      toast.error('Session is not ready yet.');
      return;
    }

    try {
      setIsSavingCustomPrompt(true);
      const trimmedPrompt = customPromptDraft.trim();
      await convex.mutation(api.messages.setCustomSystemPrompt, {
        id: chatId,
        sessionId,
        customSystemPrompt: trimmedPrompt.length > 0 ? trimmedPrompt : null,
      });
      customSystemPromptStore.set(trimmedPrompt.length > 0 ? trimmedPrompt : undefined);
      toast.success(trimmedPrompt.length > 0 ? 'Custom instructions saved' : 'Custom instructions cleared');
      setIsCustomPromptModalOpen(false);
      setCustomPromptDraft(trimmedPrompt);
    } catch (error) {
      captureException(error);
      console.error('Failed to update custom system prompt:', error);
      toast.error('Failed to update custom instructions. Please try again.');
    } finally {
      setIsSavingCustomPrompt(false);
    }
  }, [chatId, convex, customPromptDraft, isCustomPromptTooLong, sessionId]);

  // Set the initial input value
  const [searchParams] = useSearchParams();
  useEffect(() => {
    messageInputStore.set(searchParams.get('prefill') || Cookies.get(PROMPT_COOKIE_KEY) || '');
  }, [searchParams]);

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

      const token = getConvexAuthToken(convex);
      if (!token) {
        throw new Error('No auth token');
      }
      const response = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: input.trim(),
          token,
          teamSlug: selectedTeamSlug,
          deploymentName: convexProjectStore.get()?.deploymentName,
        }),
      });

      if (!response.ok) {
        if (response.status === 402) {
          throw new Error('No remaining tokens available for prompt enhancement');
        }
        throw new Error('Failed to enhance prompt. Please try again.');
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
      toast.error(error instanceof Error ? error.message : 'Failed to enhance prompt. Please try again.');
    } finally {
      setIsEnhancing(false);
    }
  }, [input, convex, selectedTeamSlug]);

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
    <>
      <div className="relative z-20 mx-auto w-full max-w-chat rounded-xl shadow transition-all duration-200">
        <div className="rounded-xl bg-background-primary/75 backdrop-blur-md">
          <div className="rounded-t-xl border transition-all has-[textarea:focus]:border-border-selected">
            <TextareaWithHighlights
              onKeyDown={handleKeyDown}
              onChange={handleChange}
              value={input}
              chatStarted={chatStarted}
              minHeight={100}
              maxHeight={chatStarted ? 400 : 200}
              placeholder={
                chatStarted
                  ? numMessages !== undefined && numMessages > 0
                    ? 'Request changes by sending another message…'
                    : 'Send a prompt for a new feature…'
                  : 'What app do you want to serve?'
              }
              disabled={disabled}
              highlights={HIGHLIGHTS}
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
              {chefAuthState.kind === 'fullyLoggedIn' && (
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
                    <Tooltip
                      tip="Recipes are Chef prompts that add powerful full-stack features to your app."
                      side="top"
                    >
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
                  <MenuItemComponent action={() => insertTemplate('Add file upload to ...')}>
                    <div className="flex w-full items-center gap-2">
                      <DocumentArrowUpIcon className="size-4 text-content-secondary" />
                      Add file upload
                    </div>
                  </MenuItemComponent>
                  <MenuItemComponent action={() => insertTemplate('Add full text search to ...')}>
                    <div className="flex w-full items-center gap-2">
                      <MagnifyingGlassIcon className="size-4 text-content-secondary" />
                      Add full text search
                    </div>
                  </MenuItemComponent>
                </MenuComponent>
              )}
              {chefAuthState.kind === 'fullyLoggedIn' && (
                <Button
                  variant={hasCustomPrompt ? 'primary' : 'neutral'}
                  inline
                  onClick={openCustomPromptModal}
                  disabled={customPromptButtonDisabled}
                  tip={
                    !sessionId
                      ? 'Please sign in to customize Chef'
                      : !chatId
                        ? 'Chat is not ready yet'
                        : "Customize Chef's instructions for this chat"
                  }
                >
                  <div className="flex items-center gap-1">
                    <AdjustmentsHorizontalIcon className="size-4" />
                    <span className="text-xs font-medium">Custom instructions</span>
                    {hasCustomPrompt && <span className="ml-1 size-2 rounded-full bg-emerald-500" aria-hidden />}
                  </div>
                </Button>
              )}
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
                icon={
                  sendMessageInProgress ? (
                    <Spinner className="text-white" />
                  ) : !isStreaming ? (
                    <ArrowRightIcon />
                  ) : (
                    <StopIcon />
                  )
                }
              />
            </div>
          </div>
        </div>
      </div>
      {isCustomPromptModalOpen && (
        <Modal
          onClose={closeCustomPromptModal}
          title="Custom system prompt"
          description="Chef will include these instructions with every request in this chat."
          size="md"
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveCustomPrompt();
            }}
          >
            <textarea
              className="mt-2 min-h-40 w-full resize-y rounded-lg border bg-background-primary p-3 text-sm text-content-primary shadow-sm focus:border-border-selected focus:outline-none"
              placeholder="Add any extra context or instructions for Chef…"
              value={customPromptDraft}
              onChange={handleCustomPromptChange}
              disabled={isSavingCustomPrompt}
            />
            <p className="text-sm text-content-secondary">
              Tailor Chef&apos;s behavior for this project. Leave the field empty to reset to the default system prompt.
            </p>
            <div className="flex items-center justify-between text-xs text-content-secondary">
              <span>
                {hasCustomPrompt ? 'Custom instructions are currently enabled.' : 'No custom instructions yet.'}
              </span>
              <span className={classNames('font-medium', isCustomPromptTooLong ? 'text-red-500' : undefined)}>
                {customPromptLength}/{CUSTOM_SYSTEM_PROMPT_MAX_LENGTH}
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="neutral" type="button" onClick={closeCustomPromptModal} disabled={isSavingCustomPrompt}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingCustomPrompt || isCustomPromptTooLong || customPromptButtonDisabled}
                loading={isSavingCustomPrompt}
              >
                Save instructions
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
});

const TextareaWithHighlights = memo(function TextareaWithHighlights({
  onKeyDown,
  onChange,
  value,
  minHeight,
  maxHeight,
  placeholder,
  disabled,
  highlights,
}: {
  onKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  value: string;
  chatStarted: boolean;
  placeholder: string;
  disabled: boolean;
  minHeight: number;
  maxHeight: number;
  highlights: Highlight[];
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Textarea auto-sizing
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  const blocks = useMemo(() => {
    const pattern = highlights
      .map((h) => h.text) // we assume text doesn’t contain special characters
      .join('|');
    const regex = new RegExp(pattern, 'gi');

    return Array.from(value.matchAll(regex)).map((match) => {
      const pos = match.index;
      return {
        from: pos,
        length: match[0].length,
        tip: highlights.find((h) => h.text === match[0].toLowerCase())!.tooltip,
      };
    });
  }, [highlights, value]);

  return (
    <div className="relative overflow-y-auto" style={{ minHeight, maxHeight }}>
      <textarea
        ref={textareaRef}
        className={classNames(
          'w-full px-3 py-3 outline-none resize-none text-content-primary placeholder-content-tertiary bg-transparent text-sm leading-snug',
          'transition-opacity',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'scrollbar-thin scrollbar-thumb-macosScrollbar-thumb scrollbar-track-transparent',
        )}
        disabled={disabled}
        onKeyDown={onKeyDown}
        onChange={onChange}
        value={value}
        style={{ minHeight }}
        placeholder={placeholder}
        translate="no"
        // Disable Grammarly
        data-gramm="false"
      />

      <HighlightBlocks textareaRef={textareaRef} text={value} blocks={blocks} />
    </div>
  );
});

const HighlightBlocks = memo(function HighlightBlocks({
  text,
  blocks,
  textareaRef,
}: {
  text: string;
  blocks: {
    from: number;
    length: number;
    tip: ReactNode;
  }[];
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [forceRerender, setForceRerender] = useState(0);

  const [blockPositions, setBlockPositions] = useState<
    {
      top: number;
      left: number;
      width: number;
      height: number;
      tip: ReactNode;
    }[]
  >([]);

  // Rerender on textarea resize
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      throw new Error('Textarea not found');
    }

    const resizeObserver = new ResizeObserver(() => {
      setForceRerender((prev) => prev + 1);
    });
    resizeObserver.observe(textarea);
    return () => resizeObserver.disconnect();
  }, [textareaRef]);

  useLayoutEffect(() => {
    if (blocks.length === 0) {
      return;
    }

    const mirror = mirrorRef.current;
    if (!mirror) {
      throw new Error('Mirror not found');
    }

    const wrapperRect = mirror.getBoundingClientRect();

    const positions = blocks.flatMap((block) => {
      const range = document.createRange();
      range.setStart(mirror.firstChild!, block.from);
      range.setEnd(mirror.firstChild!, block.from + block.length);

      const result: typeof blockPositions = [];
      for (const rect of range.getClientRects()) {
        result.push({
          top: rect.top - wrapperRect.top + mirror.scrollTop,
          left: rect.left - wrapperRect.left + mirror.scrollLeft,
          width: rect.width,
          height: rect.height,
          tip: block.tip,
        });
      }
      return result;
    });
    setBlockPositions(positions);
  }, [blocks, textareaRef, forceRerender]);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div>
      <div
        ref={mirrorRef}
        className="pointer-events-none absolute inset-0 -z-20 whitespace-pre-wrap break-words p-3 text-sm leading-snug opacity-0"
        aria-hidden
      >
        {text}
      </div>

      <div>
        {blockPositions.map((block, index) => (
          <HighlightTooltip key={index} {...block} />
        ))}
      </div>
    </div>
  );
});

const HighlightTooltip = memo(function HighlightTooltip({
  tip,
  width,
  height,
  top,
  left,
}: {
  tip: ReactNode;
  width: number;
  height: number;
  top: number;
  left: number;
}) {
  return (
    <div
      className="absolute flex overflow-hidden bg-[#f8d077] mix-blend-color"
      style={{
        width,
        height,
        top,
        left,
      }}
    >
      <Tooltip className="absolute inset-0" tip={tip}>
        {null}
      </Tooltip>
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
  const { signIn } = useAuth();

  return (
    <Button
      variant="neutral"
      onClick={() => {
        void signIn();
      }}
      size="xs"
      className="text-xs font-normal"
      icon={<img className="size-4" src="/icons/Convex.svg" alt="Convex" />}
    >
      <>
        <span>Sign in</span>
      </>
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

function TooltipLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-content-link hover:underline">
      {children}
    </a>
  );
}
