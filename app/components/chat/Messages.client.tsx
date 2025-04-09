import type { Message } from 'ai';
import { Fragment } from 'react';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { useStore } from '@nanostores/react';
import { profileStore } from '~/lib/stores/profile';
import { forwardRef } from 'react';
import type { ForwardedRef } from 'react';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Message[];
}

export const Messages = forwardRef<HTMLDivElement, MessagesProps>(
  (props: MessagesProps, ref: ForwardedRef<HTMLDivElement> | undefined) => {
    const { id, isStreaming = false, messages = [] } = props;
    const profile = useStore(profileStore);
    return (
      <div id={id} className={props.className} ref={ref}>
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
                  className={classNames('flex gap-4 p-4 w-full rounded-[calc(0.75rem-1px)]', {
                    'bg-bolt-elements-messages-background  border border-bolt-elements-borderColor mx-2': isUserMessage,
                    'mb-4': consecutiveUserMessages,
                  })}
                >
                  {isUserMessage && (
                    <div className="flex items-center justify-center w-[40px] h-[40px] overflow-hidden bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-500 rounded-full shrink-0 self-start">
                      {profile?.avatar ? (
                        <img
                          src={profile.avatar}
                          alt={profile?.username || 'User'}
                          className="w-full h-full object-cover"
                          loading="eager"
                          decoding="sync"
                        />
                      ) : (
                        <div className="i-ph:user-fill text-2xl" />
                      )}
                    </div>
                  )}
                  <div className="grid grid-col-1 w-full text-sm">
                    {isUserMessage ? <UserMessage content={content} /> : <AssistantMessage message={message} />}
                  </div>
                </div>
              );
            })
          : null}
        {isStreaming && (
          <div className="text-center w-full text-bolt-elements-textSecondary i-svg-spinners:3-dots-fade text-4xl mt-4"></div>
        )}
      </div>
    );
  },
);
