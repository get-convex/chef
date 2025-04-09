import { useParams } from '@remix-run/react';
import { classNames } from '~/utils/classNames';
import * as Dialog from '@radix-ui/react-dialog';
import { type ChatHistoryItem } from '~/types/ChatHistoryItem';
import WithTooltip from '~/components/ui/Tooltip';
import { useEditChatDescription } from '~/lib/hooks';
import { forwardRef, type ForwardedRef } from 'react';

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
        <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
          <input
            type="text"
            className="flex-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-md px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-[var(--cvx-border-selected)]/50"
            autoFocus
            value={currentDescription}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
          <button
            type="submit"
            className="i-ph:check h-4 w-4 text-gray-500 hover:text-[var(--cvx-util-accent)] transition-colors"
            onMouseDown={handleSubmit}
          />
        </form>
      ) : (
        <a href={`/chat/${item.urlId ?? item.initialId}`} className="flex w-full relative truncate block">
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
            <div className="flex items-center gap-2.5 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
              <ChatActionButton
                toolTipContent="Rename"
                icon="i-ph:pencil-fill h-4 w-4"
                onClick={(event) => {
                  event.preventDefault();
                  toggleEditMode();
                }}
              />
              <Dialog.Trigger asChild>
                <ChatActionButton
                  toolTipContent="Delete"
                  icon="i-ph:trash h-4 w-4"
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
      icon: string;
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
          className={`text-gray-400 dark:text-gray-500 hover:text-[var(--cvx-util-accent)] transition-colors ${icon} ${className ? className : ''}`}
          onClick={onClick}
        />
      </WithTooltip>
    );
  },
);
