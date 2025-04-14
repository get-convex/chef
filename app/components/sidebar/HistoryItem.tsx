import { useParams } from '@remix-run/react';
import { classNames } from '~/utils/classNames';
import * as Dialog from '@radix-ui/react-dialog';
import { type ChatHistoryItem } from '~/types/ChatHistoryItem';
import WithTooltip from '~/components/ui/Tooltip';
import { useEditChatDescription } from '~/lib/hooks';
import { forwardRef, type ForwardedRef } from 'react';
import { CheckIcon, Pencil1Icon, TrashIcon } from '@radix-ui/react-icons';

interface HistoryItemProps {
  item: ChatHistoryItem;
  handleDeleteClick: (event: React.UIEvent, item: ChatHistoryItem) => void;
}

export function HistoryItem({ item, handleDeleteClick }: HistoryItemProps) {
  const { id: urlId } = useParams();
  const isActiveChat = urlId === item.id;

  const { editing, handleChange, handleBlur, handleSubmit, handleKeyDown, currentDescription, toggleEditMode } =
    useEditChatDescription({
      initialDescription: item.description,
      customChatId: item.id,
      syncWithGlobalStore: isActiveChat,
    });

  // Chats get a description from the first message, so have a fallback so
  // they render reasonably
  const description = currentDescription ?? 'New chat…';

  return (
    <div
      className={classNames(
        'group rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-[var(--bolt-elements-sidebar-active-item-background)] overflow-hidden flex justify-between items-center px-3 py-2 transition-colors',
        { 'text-gray-900 dark:text-white bg-[var(--bolt-elements-sidebar-active-item-background)]': isActiveChat },
      )}
    >
      {editing ? (
        <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2">
          <input
            type="text"
            className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[var(--cvx-border-selected)] dark:border-gray-800 dark:bg-gray-900 dark:text-white"
            autoFocus
            value={currentDescription}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
          <button
            type="submit"
            className="size-4 text-gray-500 transition-colors hover:text-[var(--cvx-util-accent)]"
            onMouseDown={handleSubmit}
          >
            <CheckIcon />
          </button>
        </form>
      ) : (
        <a href={`/chat/${item.urlId ?? item.initialId}`} className="relative block flex w-full truncate">
          <WithTooltip tooltip={description}>
            <span className="truncate pr-24">{description}</span>
          </WithTooltip>
          <div
            className={classNames(
              {
                'bg-[var(--bolt-elements-sidebar-active-item-background)]': isActiveChat,
                'bg-[var(--bolt-elements-sidebar-background)]': !isActiveChat,
              },
              'absolute right-0 top-0 bottom-0 flex items-center group-hover:bg-[var(--bolt-elements-sidebar-active-item-background)] px-2 transition-colors',
            )}
          >
            <div className="flex items-center gap-2.5 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-gray-500">
              <ChatActionButton
                toolTipContent="Rename"
                icon={<Pencil1Icon />}
                onClick={(event) => {
                  event.preventDefault();
                  toggleEditMode();
                }}
              />
              <Dialog.Trigger asChild>
                <ChatActionButton
                  toolTipContent="Delete"
                  icon={<TrashIcon />}
                  className="hover:text-red-500"
                  onClick={(event) => {
                    event.preventDefault();
                    handleDeleteClick(event, item);
                  }}
                />
              </Dialog.Trigger>
            </div>
          </div>
        </a>
      )}
    </div>
  );
}

const ChatActionButton = forwardRef(
  (
    {
      toolTipContent,
      icon,
      className,
      onClick,
    }: {
      toolTipContent: string;
      icon: React.ReactNode;
      className?: string;
      onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
      btnTitle?: string;
    },
    ref: ForwardedRef<HTMLButtonElement>,
  ) => {
    return (
      <WithTooltip tooltip={toolTipContent} position="bottom" sideOffset={4}>
        <button
          ref={ref}
          type="button"
          className={`bg-transparent text-gray-400 transition-colors hover:text-[var(--cvx-util-accent)] dark:text-gray-500 ${className ? className : ''}`}
          onClick={onClick}
        >
          {icon}
        </button>
      </WithTooltip>
    );
  },
);
