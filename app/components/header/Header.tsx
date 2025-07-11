import { useStore } from '@nanostores/react';
import { useState } from 'react';
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
import { ReferButton } from './ReferButton';
import { useSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { useUsage } from '~/lib/stores/usage';
import { useReferralStats } from '~/lib/hooks/useReferralCode';
import { Menu } from '~/components/sidebar/Menu.client';

export function Header({ hideSidebarIcon = false }: { hideSidebarIcon?: boolean }) {
  const chat = useStore(chatStore);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const sessionId = useConvexSessionIdOrNullOrLoading();
  const isLoggedIn = sessionId !== null;
  const showSidebarIcon = !hideSidebarIcon && isLoggedIn;

  const profile = useStore(profileStore);
  const { logout } = useAuth0();

  const teamSlug = useSelectedTeamSlug();
  const { isPaidPlan } = useUsage({ teamSlug });
  const referralStats = useReferralStats();

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
      <div className="z-40 flex cursor-pointer items-center gap-2 text-content-primary">
        {showSidebarIcon && <HamburgerMenuIcon className="shrink-0" data-hamburger-menu onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} />}
        <a href="/">
          {/* The logo is shifted up slightly, to visually align it with the hamburger icon. */}
          <img src="/chef.svg" alt="Chef logo" width={72} height={42} className="relative -top-1" />
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
                  {isPaidPlan === false && referralStats && referralStats.left > 0 && <ReferButton />}
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
                    icon:
                      profile.avatar && !profile.avatar.includes('googleusercontent.com') ? (
                        <img
                          src={profile.avatar}
                          className="size-8 min-w-8 rounded-full object-cover"
                          loading="eager"
                          decoding="sync"
                        />
                      ) : (
                        <PersonIcon className="size-8 min-w-8 rounded-full border text-content-secondary" />
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
      <Menu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </header>
  );
}
