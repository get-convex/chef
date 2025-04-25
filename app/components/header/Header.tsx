import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chatId';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/components/header/ChatDescription.client';
import { DeployButton } from './DeployButton';
import { ShareButton } from './ShareButton';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import { HamburgerMenuIcon, PersonIcon, GearIcon, ExitIcon } from '@radix-ui/react-icons';
import { DownloadButton } from './DownloadButton';
import { LoggedOutHeaderButtons } from './LoggedOutHeaderButtons';
import { useAuth0 } from '@auth0/auth0-react';
import { profileStore, setProfile } from '~/lib/stores/profile';
import { Menu as MenuComponent, MenuItem as MenuItemComponent } from '@ui/Menu';
import { SESSION_ID_KEY } from '~/components/chat/ChefAuthWrapper';
import { FeedbackButton } from './FeedbackButton';
import { DiscordButton } from './DiscordButton';
import { PromptDebugButton } from './PromptDebugButton';

export function Header({ hideSidebarIcon = false }: { hideSidebarIcon?: boolean }) {
  const chat = useStore(chatStore);

  const sessionId = useConvexSessionIdOrNullOrLoading();
  const isLoggedIn = sessionId !== null;
  const showSidebarIcon = !hideSidebarIcon && isLoggedIn;

  const profile = useStore(profileStore);
  const { logout } = useAuth0();

  const handleLogout = () => {
    setProfile(null);
    window.localStorage.removeItem(SESSION_ID_KEY);
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  };

  const handleSettingsClick = () => {
    window.location.pathname = '/settings';
  };

  return (
    <header className={'flex h-[var(--header-height)] items-center overflow-x-auto overflow-y-hidden border-b p-5'}>
      <div className="z-logo flex cursor-pointer items-center gap-4 text-content-primary">
        {showSidebarIcon && <HamburgerMenuIcon className="shrink-0" />}
        <a href="/" className="flex shrink-0 flex-col text-2xl font-semibold leading-tight">
          <div className="flex items-center gap-2 font-display font-bold">
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
              chef <span className="align-baseline text-sm font-medium">by convex</span>
            </span>
          </div>
        </a>
      </div>
      <>
        {chat.started && (
          <span className="flex-1 truncate px-4 text-center text-content-primary">
            <ClientOnly>{() => <ChatDescription />}</ClientOnly>
          </span>
        )}
        <ClientOnly>
          {() => (
            <div className="ml-auto flex items-center gap-2">
              {!isLoggedIn && <LoggedOutHeaderButtons />}
              {chat.started && (
                <>
                  <PromptDebugButton />
                  <DownloadButton />
                  <ShareButton />
                  <DeployButton />
                  <div className="mr-1">
                    <HeaderActionButtons />
                  </div>
                </>
              )}
              {profile && (
                <MenuComponent
                  placement="top-start"
                  buttonProps={{
                    variant: 'neutral',
                    title: 'User menu',
                    inline: true,
                    className: 'rounded-full',
                    icon: profile.avatar ? (
                      <img
                        src={profile.avatar}
                        alt={profile.username || 'User'}
                        className="size-8 min-w-8 rounded-full object-cover"
                        loading="eager"
                        decoding="sync"
                      />
                    ) : (
                      <PersonIcon className="size-8 min-w-8" />
                    ),
                  }}
                >
                  <FeedbackButton showInMenu={true} />
                  <DiscordButton showInMenu={true} />
                  <hr />
                  <MenuItemComponent action={handleSettingsClick}>
                    <GearIcon className="text-content-secondary" />
                    Settings & Usage
                  </MenuItemComponent>
                  <MenuItemComponent action={handleLogout}>
                    <ExitIcon className="text-content-secondary" />
                    Log out
                  </MenuItemComponent>
                </MenuComponent>
              )}
            </div>
          )}
        </ClientOnly>
      </>
    </header>
  );
}
