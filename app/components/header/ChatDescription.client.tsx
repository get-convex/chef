import { useStore } from '@nanostores/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import { useEditChatDescription } from '~/lib/hooks';
import { description as descriptionStore } from '~/lib/stores/description';
import { CheckIcon, Pencil1Icon } from '@radix-ui/react-icons';
import { IconButton } from '~/components/ui/IconButton';

export function ChatDescription() {
  const initialDescription = useStore(descriptionStore)!;

  const { editing, handleChange, handleBlur, handleSubmit, handleKeyDown, currentDescription, toggleEditMode } =
    useEditChatDescription({
      initialDescription,
      syncWithGlobalStore: true,
    });

  if (!initialDescription) {
    // doing this to prevent showing edit button until chat description is set
    return null;
  }

  return (
    <div className="flex items-center justify-center">
      {editing ? (
        <form onSubmit={handleSubmit} className="flex items-center justify-center">
          <input
            type="text"
            className="bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary rounded px-2 mr-2 w-fit"
            autoFocus
            value={currentDescription}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={{ width: `${Math.max(currentDescription.length * 8, 100)}px` }}
          />
          <TooltipProvider>
            <WithTooltip tooltip="Save title">
              <IconButton icon={<CheckIcon />} onClick={handleSubmit} />
            </WithTooltip>
          </TooltipProvider>
        </form>
      ) : (
        <>
          <span className="max-w-64 truncate mr-1">{currentDescription}</span>
          <TooltipProvider>
            <WithTooltip tooltip="Rename chat">
              <IconButton icon={<Pencil1Icon />} onClick={toggleEditMode} />
            </WithTooltip>
          </TooltipProvider>
        </>
      )}
    </div>
  );
}
