import type { UIMessage } from 'ai';
import { Fragment, useCallback, useState } from 'react';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { useStore } from '@nanostores/react';
import { profileStore } from '~/lib/stores/profile';
import { forwardRef } from 'react';
import type { ForwardedRef } from 'react';
import { SpinnerThreeDots } from '~/components/ui/SpinnerThreeDots';
import { PersonIcon } from '@radix-ui/react-icons';
import { ResetIcon } from '@radix-ui/react-icons';
import { ChatBubbleIcon } from '@radix-ui/react-icons';
import { Button } from '@ui/Button';
import { Modal } from '@ui/Modal';
import { useEarliestRewindableMessageRank } from '~/lib/hooks/useEarliestRewindableMessageRank';
import { subchatIndexStore } from '~/lib/stores/subchats';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: UIMessage[];
  subchatsLength?: number;
  onRewindToMessage?: (subchatIndex?: number, messageIndex?: number) => void;
}

export const Messages = forwardRef<HTMLDivElement, MessagesProps>(function Messages(
  { id, isStreaming = false, messages = [], className, onRewindToMessage, subchatsLength }: MessagesProps,
  ref: ForwardedRef<HTMLDivElement> | undefined,
) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(null);
  const [selectedSubchatIndex, setSelectedSubchatIndex] = useState<number | undefined>(undefined);
  const currentSubchatIndex = useStore(subchatIndexStore);
  const handleRewindToMessage = useCallback(
    (subchatIndex?: number, messageIndex?: number) => {
      onRewindToMessage?.(subchatIndex, messageIndex);
    },
    [onRewindToMessage],
  );
  const profile = useStore(profileStore);
  const earliestRewindableMessageRank = useEarliestRewindableMessageRank();
  const lastSubchatIndex = subchatsLength ? subchatsLength - 1 : undefined;

  return (
    <div id={id} className={className} ref={ref}>
      {isModalOpen && selectedMessageIndex !== null && (
        <Modal
          onClose={() => {
            setIsModalOpen(false);
            setSelectedMessageIndex(null);
          }}
          title={<div className="sr-only">Rewind to message</div>}
        >
          <div className="flex flex-col gap-2">
            <h2>Rewind to previous version</h2>
            <p className="text-sm text-content-primary">
              This will undo all changes after this message. Your current work will be lost and cannot be recovered.
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
                  setIsModalOpen(false);
                  setSelectedMessageIndex(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setIsModalOpen(false);
                  handleRewindToMessage(selectedSubchatIndex, selectedMessageIndex);
                }}
              >
                Rewind
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {messages.length > 0 ? (
        messages.map((message, index) => {
          const { role, content, annotations } = message;
          const isUserMessage = role === 'user';
          const isHidden = annotations?.includes('hidden');

          if (isHidden) {
            return <Fragment key={index} />;
          }

          return (
            <div
              key={index}
              className={classNames(
                'flex gap-4 p-4 w-full rounded-[calc(0.75rem-1px)] relative border border-neutral-200 dark:border-neutral-700',
                {
                  'bg-bolt-elements-messages-background': isUserMessage,
                },
              )}
            >
              {isUserMessage && (
                <div className="flex size-[40px] shrink-0 items-center justify-center self-start overflow-hidden rounded-full bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-500">
                  {profile?.avatar ? (
                    <img
                      src={profile.avatar}
                      alt={profile?.username || 'User'}
                      className="size-full object-cover"
                      loading="eager"
                      decoding="sync"
                    />
                  ) : (
                    <PersonIcon className="size-4" />
                  )}
                </div>
              )}
              {isUserMessage ? <UserMessage content={content} /> : <AssistantMessage message={message} />}
              <div>
                {earliestRewindableMessageRank !== undefined &&
                  earliestRewindableMessageRank !== null &&
                  !isUserMessage &&
                  index >= earliestRewindableMessageRank &&
                  index !== messages.length - 1 &&
                  currentSubchatIndex !== undefined &&
                  lastSubchatIndex !== undefined &&
                  currentSubchatIndex === lastSubchatIndex}
              </div>
              {earliestRewindableMessageRank !== undefined &&
                earliestRewindableMessageRank !== null &&
                !isUserMessage &&
                index >= earliestRewindableMessageRank &&
                index !== messages.length - 1 &&
                currentSubchatIndex !== undefined &&
                lastSubchatIndex !== undefined &&
                currentSubchatIndex === lastSubchatIndex && (
                  <Button
                    className="absolute bottom-[-5px] right-[-5px] bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3"
                    onClick={() => {
                      setIsModalOpen(true);
                      setSelectedMessageIndex(index);
                      setSelectedSubchatIndex(currentSubchatIndex);
                    }}
                    variant="neutral"
                    size="xs"
                    tip="Rewind to this message"
                    title="Rewind to here"
                  >
                    <ResetIcon className="size-4 text-content-primary" />
                  </Button>
                )}
            </div>
          );
        })
      ) : (
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
          <div className="mb-6 flex size-[64px] shrink-0 items-center justify-center rounded-full text-gray-600 dark:text-gray-500">
            <ChatBubbleIcon className="size-8" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-content-primary">
            Ready to cook up a new feature or fix a bug?
          </h3>
          <p className="max-w-md text-content-secondary">Send a message below to start on your next task!</p>
        </div>
      )}

      {isStreaming && (
        <div className="flex w-full justify-center text-content-secondary">
          <SpinnerThreeDots className="size-9" />
        </div>
      )}
    </div>
  );
});
