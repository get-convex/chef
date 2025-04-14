import { motion, type Variants } from 'framer-motion';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useStore } from '@nanostores/react';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { type ChatHistoryItem } from '~/types/ChatHistoryItem';
import { cubicEasingFn } from '~/utils/easings';
import { logger } from '~/utils/logger';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';
import { useSearchFilter } from '~/lib/hooks/useSearchFilter';
import { classNames } from '~/utils/classNames';
import { useConvex, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { getConvexAuthToken, useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import { getKnownInitialId } from '~/lib/stores/chatId';
import { profileStore } from '~/lib/stores/profile';
import { useAuth0 } from '@auth0/auth0-react';
import { SESSION_ID_KEY } from '~/components/chat/ChefAuthWrapper';
import { PersonIcon, GearIcon, ExitIcon, PlusIcon } from '@radix-ui/react-icons';
import { Button } from '@convex-dev/design-system/Button';
import { TextInput } from '@convex-dev/design-system/TextInput';

const menuVariants = {
  closed: {
    opacity: 0,
    visibility: 'hidden',
    left: '-340px',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    opacity: 1,
    visibility: 'initial',
    left: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

type DialogContent = { type: 'delete'; item: ChatHistoryItem } | null;

export const Menu = memo(() => {
  const menuRef = useRef<HTMLDivElement>(null);
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const convex = useConvex();
  const list = useQuery(api.messages.getAll, sessionId ? { sessionId } : 'skip') ?? [];
  const [open, setOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const profile = useStore(profileStore);
  const { logout } = useAuth0();
  const [shouldDeleteConvexProject, setShouldDeleteConvexProject] = useState(false);
  const convexProjectInfo = useQuery(
    api.convexProjects.loadConnectedConvexProjectCredentials,
    dialogContent?.type === 'delete' && sessionId
      ? {
          sessionId,
          chatId: dialogContent.item.initialId,
        }
      : 'skip',
  );

  const { filteredItems: filteredList, handleSearchChange } = useSearchFilter({
    items: list,
    searchFields: ['description'],
  });

  const deleteItem = useCallback(
    (event: React.UIEvent, item: ChatHistoryItem) => {
      event.preventDefault();
      const accessToken = getConvexAuthToken(convex);
      if (!sessionId || !accessToken) {
        return;
      }
      convex
        .action(api.messages.remove, {
          id: item.id,
          sessionId,
          teamSlug: convexProjectInfo?.teamSlug,
          projectSlug: convexProjectInfo?.projectSlug,
          shouldDeleteConvexProject: shouldDeleteConvexProject && convexProjectInfo?.kind === 'connected',
          accessToken,
        })
        .then((result) => {
          if (result && result.kind === 'error') {
            toast.error(result.error);
          }
          if (getKnownInitialId() === item.initialId) {
            // hard page navigation to clear the stores
            window.location.pathname = '/';
          }
        })
        .catch((error) => {
          toast.error('Failed to delete conversation');
          logger.error(error);
        });
    },
    [sessionId, shouldDeleteConvexProject, convexProjectInfo],
  );

  const closeDialog = () => {
    setDialogContent(null);
    setShouldDeleteConvexProject(false);
  };

  useEffect(() => {
    const enterThreshold = 40;
    const exitThreshold = 40;

    function onMouseMove(event: MouseEvent) {
      if (event.pageX < enterThreshold) {
        setOpen(true);
      }

      if (menuRef.current && event.clientX > menuRef.current.getBoundingClientRect().right + exitThreshold) {
        setOpen(false);
      }
    }

    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  const handleDeleteClick = useCallback((event: React.UIEvent, item: ChatHistoryItem) => {
    event.preventDefault();
    setDialogContent({ type: 'delete', item });
  }, []);

  const handleLogout = () => {
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

  // Don't show the menu at all when logged out
  if (sessionId === null) {
    return null;
  }

  return (
    <>
      <motion.div
        ref={menuRef}
        initial="closed"
        animate={open ? 'open' : 'closed'}
        variants={menuVariants}
        style={{ width: '340px' }}
        className={classNames(
          'flex flex-col side-menu fixed top-0 h-full',
          'bg-[var(--bolt-elements-sidebar-background)] border-r border-bolt-elements-borderColor',
          'shadow-sm text-sm',
          'z-sidebar',
        )}
      >
        <div className="flex h-[var(--header-height)] items-center justify-between border-b border-bolt-elements-borderColor px-4"></div>

        <div className="flex size-full flex-1 flex-col overflow-hidden">
          <div className="space-y-3 p-4">
            <Button className="w-fit" href="/" icon={<PlusIcon />}>
              Start new project
            </Button>
            <div className="relative w-full">
              <TextInput
                id="search-projects"
                type="search"
                placeholder="Search projects..."
                onChange={handleSearchChange}
                aria-label="Search projects"
              />
            </div>
          </div>
          <div className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400">Your Projects</div>
          <div className="flex-1 overflow-auto px-3 pb-3">
            {filteredList.length === 0 && (
              <div className="px-4 text-sm text-gray-500 dark:text-gray-400">
                {list.length === 0 ? 'No previous projects' : 'No matches found'}
              </div>
            )}
            <DialogRoot open={dialogContent !== null}>
              {binDates(filteredList).map(({ category, items }) => (
                <div key={category} className="mt-2 space-y-1 first:mt-0">
                  <div className="sticky top-0 z-10 bg-[var(--bolt-elements-sidebar-background)] px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {category}
                  </div>
                  <div className="space-y-0.5 pr-1">
                    {items.map((item) => (
                      <HistoryItem key={item.initialId} item={item} handleDeleteClick={handleDeleteClick} />
                    ))}
                  </div>
                </div>
              ))}
              <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
                {dialogContent?.type === 'delete' && (
                  <>
                    <div className="rounded-t-lg bg-bolt-elements-background-depth-1 p-6">
                      <DialogTitle className="text-bolt-elements-textPrimary">Delete Chat?</DialogTitle>
                      <DialogDescription className="mt-2 text-bolt-elements-textSecondary">
                        <p>
                          You are about to delete{' '}
                          <span className="font-medium text-bolt-elements-textPrimary">
                            {dialogContent.item.description || 'New chat...'}
                          </span>
                        </p>
                        <p className="mt-2">Are you sure you want to delete this chat?</p>
                        {dialogContent?.type === 'delete' && sessionId && convexProjectInfo === undefined ? (
                          <div className="mt-4 flex items-center gap-2">
                            <div className="size-4 animate-pulse rounded bg-bolt-elements-background-depth-3" />
                            <div className="h-5 max-w-[280px] flex-1 animate-pulse rounded bg-bolt-elements-background-depth-3" />
                          </div>
                        ) : (
                          convexProjectInfo?.kind === 'connected' && (
                            <div className="mt-4 flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="delete-convex-project"
                                checked={shouldDeleteConvexProject}
                                onChange={(e) => setShouldDeleteConvexProject(e.target.checked)}
                                className="rounded border-bolt-elements-borderColor text-bolt-elements-button-primary-background focus:ring-bolt-elements-borderColorActive"
                              />
                              <label
                                htmlFor="delete-convex-project"
                                className="text-pretty text-bolt-elements-textSecondary"
                              >
                                Also delete the associated Convex project (
                                <a
                                  href={`https://dashboard.convex.dev/p/${convexProjectInfo.projectSlug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-bolt-elements-messages-linkColor"
                                >
                                  {convexProjectInfo.projectSlug}
                                </a>
                                )
                              </label>
                            </div>
                          )
                        )}
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 rounded-b-lg border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-6 py-4">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        Cancel
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={(event) => {
                          deleteItem(event, dialogContent.item);
                          closeDialog();
                        }}
                      >
                        Delete
                      </DialogButton>
                    </div>
                  </>
                )}
              </Dialog>
            </DialogRoot>
          </div>
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-800">
            <ThemeSwitch />
            {profile && open && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="flex size-[40px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-gray-600 transition-all hover:ring-2 hover:ring-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:hover:ring-gray-700">
                    {profile.avatar ? (
                      <img
                        src={profile.avatar}
                        alt={profile.username || 'User'}
                        className="size-full object-cover"
                        loading="eager"
                        decoding="sync"
                      />
                    ) : (
                      <PersonIcon className="size-8" />
                    )}
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="z-menu min-w-[180px] rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-1 shadow-lg"
                    sideOffset={5}
                    align="end"
                  >
                    <DropdownMenu.Item
                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-bolt-elements-textPrimary outline-none hover:bg-bolt-elements-item-backgroundActive hover:text-bolt-elements-item-contentActive"
                      onSelect={handleSettingsClick}
                    >
                      <GearIcon />
                      Settings
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-red-500 outline-none hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                      onSelect={handleLogout}
                    >
                      <ExitIcon />
                      Log out
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
});

Menu.displayName = 'Menu';
