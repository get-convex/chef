// required to avoid to many open files
// https://github.com/phosphor-icons/react/issues/45
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp';

interface SuggestionButtonsProps {
  chatStarted: boolean;
  onSuggestionClick?: (suggestion: string) => void;
  disabled?: boolean;
}

export const SuggestionButtons = ({ chatStarted, onSuggestionClick, disabled }: SuggestionButtonsProps) => {
  if (chatStarted) {
    return null;
  }

  const suggestions = [
    {
      title: 'Build a slack clone',
      prompt: `Build an app similar to Slack. It should have a channels panel on the left with a button to create new channels. There should be a message pane on the right and a message posting box at the bottom. Each message should have a name and avatar next to it for the author of the message. There should be an "edit profile" tab that allows you to upload a profile photo and change your name. Make sure that the messages are the only thing that is scrollable. The message box and channel selector should stay fixed like the header. Make sure you scroll to the bottom when new messages are sent.`,
    },
    {
      title: 'Build an Instagram clone',
      prompt:
        'Build an app similar to Instagram except it\'s a global shared image stream with all users. There should be a box you can drag and drop images into to upload them. When uploading an image it should get resized to a maximum of 800x800 and be cropped to a square. There should be a "Stream" tab for viewing the global stream and a "My Photos" tab for viewing your own images. You should be able to delete your own photos in the "My Photos" tab. You should be able to click a button to like each image in the "Stream" tab and it should show the like count for each image.',
    },
    {
      title: 'Build a todo app',
      prompt:
        'Build a Todo app with two different tabs, "To Do" and "Done". Add the ability to add tags to a task when creating it and filter tasks by tag',
    },
  ];

  return (
    <div id="suggestions" className="flex flex-col justify-center items-center">
      <div className="flex gap-6">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.title}
            onClick={() => onSuggestionClick?.(suggestion.prompt)}
            className="flex gap-1 items-center rounded-full px-3 py-1 border border-bolt-elements-borderColor bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-bolt-elements-item-backgroundDefault disabled:hover:text-bolt-elements-textSecondary"
            disabled={disabled}
          >
            <ArrowUp className="size-4" />
            {suggestion.title}
          </button>
        ))}
      </div>
    </div>
  );
};
