import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chatId';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/components/header/ChatDescription.client';
import { DeployButton } from './DeployButton';
import { FeedbackButton } from './FeedbackButton';
import { ShareButton } from './ShareButton';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';

export function Header({ hideSidebarIcon = false }: { hideSidebarIcon?: boolean }) {
  const chat = useStore(chatStore);

  const sessionId = useConvexSessionIdOrNullOrLoading();
  const isLoggedIn = sessionId !== null;
  const showSidebarIcon = !hideSidebarIcon && isLoggedIn;

  return (
    <header
      className={classNames('flex items-center p-5 border-b h-[var(--header-height)]', {
        'border-transparent': !chat.started,
        'border-bolt-elements-borderColor': chat.started,
      })}
    >
      <div className="flex items-center gap-4 z-logo text-bolt-elements-textPrimary cursor-pointer">
        {showSidebarIcon && <div className="i-ph:sidebar-simple-duotone text-xl" />}
        <a href="/" className="text-2xl font-semibold flex flex-col leading-tight">
          <div className="flex items-center font-display font-bold gap-2">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M3 16H21V21C21 22.6569 19.6569 24 18 24H6C4.34315 24 3 22.6569 3 21V16ZM8 18C8 17.4477 8.44772 17 9 17C9.55228 17 10 17.4477 10 18V20C10 20.5523 9.55228 21 9 21C8.44772 21 8 20.5523 8 20V18ZM15 17C14.4477 17 14 17.4477 14 18V20C14 20.5523 14.4477 21 15 21C15.5523 21 16 20.5523 16 20V18C16 17.4477 15.5523 17 15 17Z"
                fill="#F1A71A"
              />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M21 15C21.8898 12.3307 24 8.82668 24 6C24 3.51472 21.9853 1.5 19.5 1.5C18.487 1.5 17.5522 1.83472 16.8001 2.39958C15.7055 0.942484 13.9628 0 12 0C10.0372 0 8.29454 0.942482 7.19988 2.39958C6.4478 1.83471 5.51299 1.5 4.5 1.5C2.01472 1.5 0 3.51472 0 6C0 8.82668 2.11023 12.3307 3 15H6.49611L5.50386 7.06202C5.46961 6.78801 5.66397 6.53811 5.93798 6.50386C6.21199 6.46961 6.46189 6.66397 6.49614 6.93798L7.49614 14.938C7.49874 14.9588 7.50003 14.9795 7.50005 15H11.5V7C11.5 6.72386 11.7239 6.5 12 6.5C12.2761 6.5 12.5 6.72386 12.5 7V15H16.4999C16.5 14.9795 16.5013 14.9588 16.5039 14.938L17.5039 6.93798C17.5381 6.66397 17.788 6.46961 18.062 6.50386C18.336 6.53811 18.5304 6.78801 18.4961 7.06202L17.5039 15H21Z"
                fill="#EB2E29"
              />
            </svg>
            <span className="flex items-baseline gap-2">
              chef <span className="text-sm align-baseline font-medium">by convex</span>
            </span>
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
                <ShareButton />
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
