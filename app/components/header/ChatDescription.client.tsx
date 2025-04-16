import { useStore } from '@nanostores/react';
import { useEditChatDescription } from '~/lib/hooks/useEditChatDescription';
import { description as descriptionStore } from '~/lib/stores/description';
import { CheckIcon, Pencil1Icon } from '@radix-ui/react-icons';
import { Button } from '@ui/Button';
import { TextInput } from '@ui/TextInput';

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
          <TextInput
            labelHidden
            autoFocus
            className="mr-2"
            id="chat-description"
            value={currentDescription}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
          <Button variant="neutral" onClick={handleSubmit} icon={<CheckIcon />} inline size="xs" tip="Save title" />
        </form>
      ) : (
        <>
          <span className="mr-1 max-w-64 truncate">{currentDescription}</span>
          <Button
            variant="neutral"
            onClick={toggleEditMode}
            icon={<Pencil1Icon />}
            inline
            size="xs"
            tip="Rename chat"
          />
        </>
      )}
    </div>
  );
}
