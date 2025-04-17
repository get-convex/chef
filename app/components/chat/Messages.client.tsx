import type { Message } from 'ai';
import { Fragment } from 'react';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { useStore } from '@nanostores/react';
import { profileStore } from '~/lib/stores/profile';
import { forwardRef } from 'react';
import type { ForwardedRef } from 'react';
import { SpinnerThreeDots } from '~/components/ui/SpinnerThreeDots';
import { PersonIcon } from '@radix-ui/react-icons';
import { RotateCounterClockwiseIcon } from '@radix-ui/react-icons';
import { Button } from '@ui/Button';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Message[];
  onRewindToMessage?: (index: number) => void;
  earliestRewindableMessageRank?: number;
}

export const Messages = forwardRef<HTMLDivElement, MessagesProps>(function Messages(
  {
    id,
    isStreaming = false,
    messages = [],
    className,
    onRewindToMessage,
    earliestRewindableMessageRank,
  }: MessagesProps,
  ref: ForwardedRef<HTMLDivElement> | undefined,
) {
  const profile = useStore(profileStore);
  return (
    <div id={id} className={className} ref={ref}>
      {messages.length > 0
        ? messages.map((message, index) => {
            const { role, content, annotations } = message;
            const isUserMessage = role === 'user';
            const isHidden = annotations?.includes('hidden');

            if (isHidden) {
              return <Fragment key={index} />;
            }

            // When the agent hits an error, we can have two user messages
            // back to back without spacing. Add `mb-4` in this condition.
            let consecutiveUserMessages = false;
            if (isUserMessage && index < messages.length - 1) {
              consecutiveUserMessages = messages[index + 1].role === 'user';
            }
            return (
              <div
                key={index}
                className={classNames('flex gap-4 p-4 w-full rounded-[calc(0.75rem-1px)] relative', {
                  'bg-bolt-elements-messages-background  border mx-2 ': isUserMessage,
                  'mb-4': consecutiveUserMessages,
                })}
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
                {earliestRewindableMessageRank !== undefined && index >= earliestRewindableMessageRank && (
                  <button
                    className="absolute right-2 top-2 rounded-lg bg-gray-100 p-1.5 text-gray-500 hover:bg-gray-200"
                    onClick={() => onRewindToMessage?.(index)}
                    title="Rewind to here"
                  >
                    <RotateCounterClockwiseIcon className="size-4" />
                  </button>
                )}
              </div>
            );
          })
        : null}
      {isStreaming && (
        <div className="mt-4 flex w-full justify-center text-content-secondary">
          <SpinnerThreeDots className="size-9" />
        </div>
      )}
    </div>
  );
});
