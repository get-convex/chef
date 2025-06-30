import { Button } from '@ui/Button';
import { PlusIcon } from '@radix-ui/react-icons';
import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { subchatIndexStore, subchatLoadedStore } from '~/components/ExistingChat.client';
import type { Id } from '@convex/_generated/dataModel';
import { useCallback, useState } from 'react';
import { Modal } from '@ui/Modal';
import { ArrowLeftIcon, ArrowRightIcon } from '@radix-ui/react-icons';

interface SubchatLimitNudgeProps {
  sessionId: Id<'sessions'> | null;
  chatId: string;
  messageCount: number;
}

export function SubchatLimitNudge({ sessionId, chatId, messageCount }: SubchatLimitNudgeProps) {
  const createSubchat = useMutation(api.subchats.create);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleCreateSubchat = useCallback(async () => {
    if (!sessionId) {
      return;
    }
    const subchatIndex = await createSubchat({ chatId, sessionId });
    subchatLoadedStore.set(false);
    subchatIndexStore.set(subchatIndex);
  }, [createSubchat, chatId, sessionId]);

  return (
    <>
      {isCreateModalOpen && (
        <Modal
          onClose={() => {
            setIsCreateModalOpen(false);
          }}
          title="Start a new chat"
        >
          <div className="flex flex-col gap-2">
            <p className="text-sm text-content-primary">
              Your current chat has reached {messageCount} messages. To keep your conversation focused and improve
              performance, we recommend starting a new chat.
            </p>
            <p className="text-sm text-content-primary">
              This will create a fresh chat with clean context while preserving your current work. You can navigate back
              to view previous messages using the{' '}
              <ArrowLeftIcon className="inline size-5 rounded border border-content-secondary/20 bg-background-secondary p-0.5" />{' '}
              <ArrowRightIcon className="inline size-5 rounded border border-content-secondary/20 bg-background-secondary p-0.5" />{' '}
              buttons.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="neutral"
                onClick={() => {
                  setIsCreateModalOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  handleCreateSubchat();
                }}
              >
                Start New Chat
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <div className="mx-auto w-full max-w-chat rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/50">
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900">
            <PlusIcon className="size-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-medium text-orange-800 dark:text-orange-200">Create a new chat</h3>
              <p className="mt-1 text-sm text-orange-700 dark:text-orange-300">
                Your conversation has reached {messageCount} messages. For better performance, we recommend creating a
                new chat. This will preserve your current work, but provide you with a clean context.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              className="bg-orange-600 text-white hover:bg-orange-700"
              icon={<PlusIcon />}
              disabled={!sessionId}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Start New Chat
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
