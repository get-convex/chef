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
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import { getKnownInitialId } from '~/lib/stores/chatId';
import { profileStore } from '~/lib/stores/profile';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from '@remix-run/react';

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
  const navigate = useNavigate();
  const list = useQuery(api.messages.getAll, sessionId ? { sessionId } : 'skip') ?? [];
  const [open, setOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const profile = useStore(profileStore);
  const { logout } = useAuth0();

  const { filteredItems: filteredList, handleSearchChange } = useSearchFilter({
    items: list,
    searchFields: ['description'],
  });

  const deleteItem = useCallback((event: React.UIEvent, item: ChatHistoryItem) => {
    event.preventDefault();
    if (!sessionId) {
      return;
    }
    convex
      .mutation(api.messages.remove, { id: item.id, sessionId })
      .then(() => {
        if (getKnownInitialId() === item.initialId) {
          // hard page navigation to clear the stores
          window.location.pathname = '/';
        }
      })
      .catch((error) => {
        toast.error('Failed to delete conversation');
        logger.error(error);
      });
  }, []);

  const closeDialog = () => {
    setDialogContent(null);
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
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  // Don’t show the menu at all when logged out
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
        <div className="h-[var(--header-height)] flex items-center justify-between px-4 border-b border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-900/50"></div>

        <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
          <div className="p-4 space-y-3">
            <a
              href="/"
              className="inline-flex gap-2 items-center bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text hover:text-bolt-elements-button-primary-textHover rounded-lg px-4 py-2 transition-colors"
            >
              <span className="text-sm font-medium">Start new project</span>
            </a>
            <div className="relative w-full">
              <input
                className="w-full bg-gray-50 dark:bg-gray-900 relative px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-800"
                type="search"
                placeholder="Search projects..."
                onChange={handleSearchChange}
                aria-label="Search projects"
              />
            </div>
          </div>
          <div className="text-gray-600 dark:text-gray-400 text-sm font-medium px-4 py-2">Your Projects</div>
          <div className="flex-1 overflow-auto px-3 pb-3">
            {filteredList.length === 0 && (
              <div className="px-4 text-gray-500 dark:text-gray-400 text-sm">
                {list.length === 0 ? 'No previous projects' : 'No matches found'}
              </div>
            )}
            <DialogRoot open={dialogContent !== null}>
              {binDates(filteredList).map(({ category, items }) => (
                <div key={category} className="mt-2 first:mt-0 space-y-1">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 sticky top-0 z-1 bg-[var(--bolt-elements-sidebar-background)] px-3 py-1">
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
                    <div className="p-6 bg-white dark:bg-gray-950 rounded-t-lg">
                      <DialogTitle className="text-gray-900 dark:text-white">Delete Chat?</DialogTitle>
                      <DialogDescription className="mt-2 text-gray-600 dark:text-gray-400">
                        <p>
                          You are about to delete{' '}
                          <span className="font-medium text-gray-900 dark:text-white">
                            {dialogContent.item.description}
                          </span>
                        </p>
                        <p className="mt-2">Are you sure you want to delete this chat?</p>
                      </DialogDescription>
                    </div>
                    <div className="rounded-b-lg flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
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
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-800 px-4 py-3">
            <ThemeSwitch />
            {open && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="flex items-center justify-center w-[40px] h-[40px] overflow-hidden bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-500 rounded-full shrink-0 hover:ring-2 hover:ring-gray-200 dark:hover:ring-gray-700 transition-all">
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
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="z-menu min-w-[180px] bg-bolt-elements-background-depth-1 rounded-lg p-1 shadow-lg border border-bolt-elements-borderColor"
                    sideOffset={5}
                    align="end"
                  >
                    <DropdownMenu.Item
                      className="flex items-center gap-2 px-3 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive hover:text-bolt-elements-item-contentActive rounded-md cursor-pointer outline-none"
                      onSelect={handleSettingsClick}
                    >
                      <div className="i-ph:gear-six" />
                      Settings
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md cursor-pointer outline-none"
                      onSelect={handleLogout}
                    >
                      <div className="i-ph:sign-out" />
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
