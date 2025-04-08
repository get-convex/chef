import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/convex';
import { DeployButton } from './DeployButton';
import { FeedbackButton } from './FeedbackButton';

export function Header() {
  const chat = useStore(chatStore);
  const sessionId = useConvexSessionIdOrNullOrLoading();

  if (sessionId === null) {
    return null;
  }

  return (
    <header
      className={classNames('flex items-center p-5 border-b h-[var(--header-height)]', {
        'border-transparent': !chat.started,
        'border-bolt-elements-borderColor': chat.started,
      })}
    >
      <div className="flex items-center gap-2 z-logo text-bolt-elements-textPrimary cursor-pointer">
        <div className="i-ph:sidebar-simple-duotone text-xl" />
        <a href="/" className="text-2xl font-semibold flex flex-col leading-tight">
          <div className="flex items-center ml-2 font-display font-bold gap-2">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M0 21C0 19.3431 1.34315 18 3 18H21C22.6569 18 24 19.3431 24 21V24H0V21ZM9 21C9 22.1046 8.10457 23 7 23C5.89543 23 5 22.1046 5 21C5 19.8954 5.89543 19 7 19C8.10457 19 9 19.8954 9 21ZM17 23C18.1046 23 19 22.1046 19 21C19 19.8954 18.1046 19 17 19C15.8954 19 15 19.8954 15 21C15 22.1046 15.8954 23 17 23Z"
                fill="#F1A71A"
              />
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M21 13C21.8898 10.6866 24 7.64979 24 5.2C24 3.04609 21.9853 1.3 19.5 1.3C18.487 1.3 17.5522 1.59009 16.8001 2.07964C15.7055 0.816819 13.9628 0 12 0C10.0372 0 8.29454 0.816818 7.19988 2.07963C6.4478 1.59009 5.51299 1.3 4.5 1.3C2.01472 1.3 0 3.04609 0 5.2C0 7.64979 2.11023 10.6866 3 13H6.49611L5.50386 6.12042C5.46961 5.88294 5.66397 5.66636 5.93798 5.63668C6.21199 5.607 6.46189 5.77544 6.49614 6.01292L7.49614 12.9463C7.49874 12.9643 7.50003 12.9823 7.50005 13H11.5V6.06667C11.5 5.82734 11.7239 5.63333 12 5.63333C12.2761 5.63333 12.5 5.82734 12.5 6.06667V13H16.4999C16.5 12.9823 16.5013 12.9643 16.5039 12.9463L17.5039 6.01292C17.5381 5.77544 17.788 5.607 18.062 5.63668C18.336 5.66636 18.5304 5.88294 18.4961 6.12042L17.5039 13H21Z"
                fill="#EB2E29"
              />
              <rect x="3" y="14" width="18" height="3" fill="#EB2E29" />
            </svg>
            chef
          </div>
        </a>
      </div>
      {chat.started && (
        <>
          <span className="flex-1 px-4 truncate text-center text-bolt-elements-textPrimary">
            <ClientOnly>{() => <ChatDescription />}</ClientOnly>
          </span>
          <ClientOnly>
            {() => (
              <div className="flex items-center gap-2 flex-wrap">
                <FeedbackButton />
                <DeployButton />
                <div className="mr-1">
                  <HeaderActionButtons />
                </div>
              </div>
            )}
          </ClientOnly>
        </>
      )}
    </header>
  );
}
