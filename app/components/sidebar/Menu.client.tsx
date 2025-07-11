import { motion, type Variants } from 'framer-motion';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@ui/ConfirmationDialog';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { type ChatHistoryItem } from '~/types/ChatHistoryItem';
import { cubicEasingFn } from '~/utils/easings';
import { logger } from 'chef-agent/utils/logger';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';
import { useSearchFilter } from '~/lib/hooks/useSearchFilter';
import { classNames } from '~/utils/classNames';
import { useConvex, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { getConvexAuthToken, useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import { getKnownInitialId } from '~/lib/stores/chatId';
import { Button } from '@ui/Button';
import { TextInput } from '@ui/TextInput';
import { Checkbox } from '@ui/Checkbox';
import { PlusIcon } from '@radix-ui/react-icons';

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

type ModalContent = { type: 'delete'; item: ChatHistoryItem } | null;

interface MenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Menu = memo(({ isOpen, onClose }: MenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const convex = useConvex();
  const list = useQuery(api.messages.getAll, sessionId ? { sessionId } : 'skip') ?? [];
  const [dialogContent, setDialogContent] = useState<ModalContent>(null);
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
    (item: ChatHistoryItem) => {
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
    [
      convex,
      sessionId,
      convexProjectInfo?.teamSlug,
      convexProjectInfo?.projectSlug,
      convexProjectInfo?.kind,
      shouldDeleteConvexProject,
    ],
  );

  const closeDialog = () => {
    setDialogContent(null);
    setShouldDeleteConvexProject(false);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;

      // Don't close if clicking on the hamburger icon
      if (target?.closest('[data-hamburger-menu]')) {
        return;
      }

      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleDeleteClick = useCallback((item: ChatHistoryItem) => {
    setDialogContent({ type: 'delete', item });
  }, []);

  // Don't show the menu at all when logged out
  if (sessionId === null) {
    return null;
  }

  return (
    <>
      <motion.div
        ref={menuRef}
        initial="closed"
        animate={isOpen ? 'open' : 'closed'}
        variants={menuVariants}
        style={{ width: '340px' }}
        className={classNames(
          'flex flex-col side-menu fixed top-0 h-full',
          'bg-[var(--bolt-elements-sidebar-background)] border-r',
          'shadow-sm text-sm',
          'z-30',
        )}
      >
        <div className="flex h-[var(--header-height)] items-center justify-between border-b px-4"></div>

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
            {dialogContent?.type === 'delete' && (
              <ConfirmationDialog
                onClose={closeDialog}
                confirmText={'Delete'}
                onConfirm={() => {
                  if (dialogContent?.type === 'delete') {
                    deleteItem(dialogContent.item);
                  }
                  closeDialog();
                  return Promise.resolve();
                }}
                dialogTitle="Delete Chat"
                validationText={dialogContent?.item.description || 'New chat...'}
                dialogBody={
                  <>
                    <p>
                      You are about to delete{' '}
                      <span className="font-medium text-content-primary">
                        {dialogContent?.item.description || 'New chat...'}
                      </span>
                    </p>
                    {convexProjectInfo?.kind === 'connected' && (
                      <div className="mt-4 flex items-center gap-2">
                        <Checkbox
                          id="delete-convex-project"
                          checked={shouldDeleteConvexProject}
                          onChange={() => setShouldDeleteConvexProject(!shouldDeleteConvexProject)}
                        />

                        <label htmlFor="delete-convex-project" className="text-pretty text-content-secondary">
                          Also delete the associated Convex project (
                          <a
                            href={`https://dashboard.convex.dev/p/${convexProjectInfo.projectSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-content-link hover:underline"
                          >
                            {convexProjectInfo.projectSlug}
                          </a>
                          )
                        </label>
                      </div>
                    )}
                  </>
                }
              />
            )}
          </div>
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-800">
            <ThemeSwitch />
          </div>
        </div>
      </motion.div>
    </>
  );
});

Menu.displayName = 'Menu';
