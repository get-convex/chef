import { Button } from '@ui/Button';
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon, ResetIcon } from '@radix-ui/react-icons';
import { classNames } from '~/utils/classNames';
import type { Id } from '@convex/_generated/dataModel';
import { useCallback, useState } from 'react';
import { Modal } from '@ui/Modal';
import { Combobox } from '@ui/Combobox';
import { TimestampDistance } from '~/components/ui/TimestampDistance';
import { subchatIndexStore } from '~/lib/stores/subchats';
import { Spinner } from '@ui/Spinner';
import { useAreFilesSaving } from '~/lib/stores/fileUpdateCounter';

interface SubchatBarProps {
  subchats?: { subchatIndex: number; updatedAt: number; description?: string }[];
  currentSubchatIndex: number;
  isStreaming: boolean;
  disableChatMessage: boolean;
  sessionId: Id<'sessions'> | null;
  handleCreateSubchat: () => void;
  onRewind?: (subchatIndex?: number, messageIndex?: number) => void;
  isSubchatLoaded: boolean;
}

export function SubchatBar({
  subchats,
  currentSubchatIndex,
  isStreaming,
  disableChatMessage,
  sessionId,
  onRewind,
  handleCreateSubchat,
  isSubchatLoaded,
}: SubchatBarProps) {
  const [isRewindModalOpen, setIsRewindModalOpen] = useState(false);
  const [isAddChatModalOpen, setIsAddChatModalOpen] = useState(false);
  const areFilesSaving = useAreFilesSaving();

  const canNavigatePrev = subchats && subchats.length > 1 && currentSubchatIndex > 0;
  const canNavigateNext = subchats && subchats.length > 1 && currentSubchatIndex < subchats.length - 1;

  const handleNavigateToSubchat = useCallback(
    (index: number) => {
      if (!subchats || subchats.length <= 1) {
        return;
      }
      if (index < 0 || index >= subchats.length) {
        return;
      }

      subchatIndexStore.set(index);
    },
    [subchats],
  );

  const handleRewind = useCallback(
    (subchatIndex?: number) => {
      onRewind?.(subchatIndex, undefined);
    },
    [onRewind],
  );

  const getSubchatDisplayName = useCallback(
    (subchat: { subchatIndex: number; description?: string }, arrayIndex: number) => {
      if (subchat.description) {
        return subchat.description;
      }
      return arrayIndex === 0 ? 'Initial chat' : `Feature #${arrayIndex}`;
    },
    [],
  );

  const subchatOptions =
    subchats?.map((subchat, arrayIndex) => ({
      label: getSubchatDisplayName(subchat, arrayIndex),
      value: subchat.subchatIndex,
      subchat,
      arrayIndex,
    })) ?? [];

  return (
    <div className="sticky top-0 z-[2] mx-auto mb-4 w-full max-w-chat pt-4">
      {isRewindModalOpen && (
        <Modal
          onClose={() => {
            setIsRewindModalOpen(false);
          }}
          title={<div className="sr-only">Rewind to previous chat</div>}
        >
          <div className="flex flex-col gap-2">
            <h2>Rewind to previous chat</h2>
            <p className="text-sm text-content-primary">
              This will undo all changes after this chat. Your current work will be lost and cannot be recovered.
            </p>
            <p className="text-sm text-content-primary">
              Your Convex data will be unaffected, so you may need to either clear or migrate your data in order to use
              this previous version.
            </p>
            <p className="text-sm text-content-primary">Are you sure you want to continue?</p>
            <div className="flex justify-end gap-2">
              <Button
                variant="neutral"
                onClick={() => {
                  setIsRewindModalOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setIsRewindModalOpen(false);
                  handleRewind(currentSubchatIndex);
                }}
              >
                Rewind
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {isAddChatModalOpen && (
        <Modal
          onClose={() => {
            setIsAddChatModalOpen(false);
          }}
          title="Create new chat"
        >
          <div className="flex flex-col gap-2">
            <p className="text-sm text-content-primary">
              This will create a new chat with fresh context. This can be useful for starting work on a new feature of
              your app, or fixing a bug unrelated to your recent changes. You can always navigate back to previous chats
              using{' '}
              <ArrowLeftIcon className="inline size-5 rounded border border-content-secondary/20 bg-background-secondary p-0.5" />{' '}
              <ArrowRightIcon className="inline size-5 rounded border border-content-secondary/20 bg-background-secondary p-0.5" />{' '}
              to view your chat history, but you won&apos;t be able to send more messages in previous chats.
            </p>
            <p className="text-sm text-content-primary">Are you sure you want to continue?</p>
            <div className="flex justify-end gap-2">
              <Button
                variant="neutral"
                onClick={() => {
                  setIsAddChatModalOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setIsAddChatModalOpen(false);
                  handleCreateSubchat();
                }}
              >
                Create Chat
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <div className="flex items-center justify-between gap-2 rounded-lg border border-content-secondary/20 bg-background-secondary/90 px-4 py-2 backdrop-blur-sm">
        <div className="flex min-w-0 grow items-center gap-2">
          <div className={classNames('flex rounded-lg bg-background-secondary border')}>
            <Button
              size="xs"
              variant="neutral"
              className={classNames('rounded-r-none border-0 border-border-transparent dark:border-border-transparent')}
              icon={<ArrowLeftIcon className="my-px" />}
              inline
              tip={
                isStreaming
                  ? 'Navigation disabled while generating a response'
                  : !isSubchatLoaded
                    ? 'Loading...'
                    : areFilesSaving
                      ? 'Saving...'
                      : 'Previous Chat'
              }
              disabled={!canNavigatePrev || isStreaming || !isSubchatLoaded || areFilesSaving}
              onClick={() => {
                handleNavigateToSubchat(currentSubchatIndex - 1);
              }}
            />
            <Button
              size="xs"
              variant="neutral"
              className={classNames('rounded-l-none border-0 border-border-transparent dark:border-border-transparent')}
              icon={<ArrowRightIcon className="my-px" />}
              inline
              tip={
                isStreaming
                  ? 'Navigation disabled while generating a response'
                  : !isSubchatLoaded
                    ? 'Loading...'
                    : areFilesSaving
                      ? 'Saving...'
                      : 'Next Chat'
              }
              disabled={!canNavigateNext || isStreaming || !isSubchatLoaded || areFilesSaving}
              onClick={() => {
                handleNavigateToSubchat(currentSubchatIndex + 1);
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <Combobox
              searchPlaceholder="Search chats..."
              label="Select chat"
              labelHidden
              className="max-w-full"
              buttonClasses="w-full"
              innerButtonClasses="border-none bg-transparent"
              disabled={isStreaming || !isSubchatLoaded}
              optionsWidth="fit"
              options={subchatOptions.reverse()}
              selectedOption={currentSubchatIndex}
              setSelectedOption={(subchatIndex) => {
                if (subchatIndex !== null && !isStreaming && isSubchatLoaded) {
                  handleNavigateToSubchat(subchatIndex);
                }
              }}
              Option={({ value, inButton }) => {
                let option = subchatOptions.find((opt) => opt.value === value);
                // We optimistically add the current subchat if it hasn't been persisted yet
                if (!option && value === currentSubchatIndex) {
                  option = {
                    label: value === 0 ? 'Initial chat' : `Feature #${value}`,
                    value: currentSubchatIndex,
                    subchat: {
                      subchatIndex: currentSubchatIndex,
                      updatedAt: Date.now(),
                    },
                    arrayIndex: currentSubchatIndex,
                  };
                }
                if (!option) {
                  return null;
                }

                const { subchat } = option;

                return (
                  <div className="flex max-w-96 flex-col gap-1 truncate">
                    <div className="truncate text-sm">{option.label}</div>
                    {!inButton && (
                      <div className="text-left">
                        <TimestampDistance date={new Date(subchat.updatedAt)} />
                      </div>
                    )}
                  </div>
                );
              }}
            />
            {!isSubchatLoaded && <Spinner />}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentSubchatIndex >= (subchats?.length ?? 1) - 1 && sessionId ? (
            <Button
              size="xs"
              variant="neutral"
              className={classNames('flex rounded-lg bg-background-secondary border')}
              icon={<PlusIcon className="my-px" />}
              disabled={disableChatMessage || isStreaming || !isSubchatLoaded || areFilesSaving}
              inline
              tip={
                isStreaming
                  ? 'New chats disabled while generating a response'
                  : !isSubchatLoaded
                    ? 'Loading...'
                    : areFilesSaving
                      ? 'Saving...'
                      : 'New Chat'
              }
              onClick={() => {
                setIsAddChatModalOpen(true);
              }}
            />
          ) : (
            <Button
              size="xs"
              variant="neutral"
              className={classNames('flex rounded-lg bg-background-secondary border')}
              icon={<ResetIcon className="my-px" />}
              inline
              tip={!isSubchatLoaded ? 'Loading...' : 'Rewind to this chat'}
              disabled={currentSubchatIndex < 0 || !isSubchatLoaded}
              onClick={() => {
                setIsRewindModalOpen(true);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
