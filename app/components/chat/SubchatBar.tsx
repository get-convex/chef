import { Button } from '@ui/Button';
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon, ResetIcon } from '@radix-ui/react-icons';
import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { subchatIndexStore, subchatLoadedStore } from '~/components/ExistingChat.client';
import { classNames } from '~/utils/classNames';
import type { Id } from '@convex/_generated/dataModel';
import { useCallback, useState } from 'react';
import { Modal } from '@ui/Modal';

interface SubchatBarProps {
  subchats?: { subchatIndex: number; description?: string }[];
  currentSubchatIndex: number;
  isStreaming: boolean;
  disableChatMessage: boolean;
  sessionId: Id<'sessions'> | null;
  chatId: string;
  onRewind?: (subchatIndex?: number, messageIndex?: number) => void;
}

export function SubchatBar({
  subchats,
  currentSubchatIndex,
  isStreaming,
  disableChatMessage,
  sessionId,
  chatId,
  onRewind,
}: SubchatBarProps) {
  const createSubchat = useMutation(api.subchats.create);
  const [isRewindModalOpen, setIsRewindModalOpen] = useState(false);
  const [isAddChatModalOpen, setIsAddChatModalOpen] = useState(false);

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

      subchatLoadedStore.set(false);
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

  const handleCreateSubchat = useCallback(async () => {
    if (!sessionId) {
      return;
    }
    const subchatIndex = await createSubchat({ chatId, sessionId });
    subchatLoadedStore.set(false);
    subchatIndexStore.set(subchatIndex);
  }, [createSubchat, chatId, sessionId]);

  return (
    <div className="sticky top-0 z-10 mx-auto mb-4 w-full max-w-chat pt-4">
      {isRewindModalOpen && (
        <Modal
          onClose={() => {
            setIsRewindModalOpen(false);
          }}
          title={<div className="sr-only">Rewind to subchat</div>}
        >
          <div className="flex flex-col gap-2">
            <h2>Rewind to previous version</h2>
            <p className="text-sm text-content-primary">
              This will undo all changes after this subchat. Your current work will be lost and cannot be recovered.
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
          title={<div className="sr-only">Create new subchat</div>}
        >
          <div className="flex flex-col gap-2">
            <h2>Create new subchat</h2>
            <p className="text-sm text-content-primary">
              This will create a new subchat branch from the current point. You can always navigate back to previous
              subchats using the navigation buttons.
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
                Create Subchat
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <div className="flex items-center justify-between rounded-lg border border-content-secondary/20 bg-background-secondary/90 px-4 py-2 backdrop-blur-sm">
        <div className={classNames('flex rounded-lg bg-background-secondary border')}>
          <Button
            size="xs"
            variant="neutral"
            className={classNames('rounded-r-none border-0 border-border-transparent dark:border-border-transparent')}
            icon={<ArrowLeftIcon className="my-px" />}
            inline
            tip="Previous Chat"
            disabled={!canNavigatePrev || isStreaming}
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
            tip="Next Subchat"
            disabled={!canNavigateNext || isStreaming}
            onClick={() => {
              handleNavigateToSubchat(currentSubchatIndex + 1);
            }}
          />
        </div>

        <div className="flex items-center gap-2 text-sm font-medium text-content-secondary">
          <span>Subchat</span>
          <span className="text-content-primary">{currentSubchatIndex + 1}</span>
          <span>of</span>
          <span className="text-content-primary">{Math.max(currentSubchatIndex + 1, subchats?.length ?? 1)}</span>
        </div>

        <div className="flex items-center gap-2">
          {currentSubchatIndex === (subchats?.length ?? 1) - 1 && sessionId ? (
            <Button
              size="xs"
              variant="neutral"
              className={classNames('flex rounded-lg bg-background-secondary border')}
              icon={<PlusIcon className="my-px" />}
              disabled={disableChatMessage || isStreaming}
              inline
              tip="New Chat"
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
              tip="Rewind to this version"
              disabled={currentSubchatIndex === 0}
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
