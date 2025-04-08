// required to avoid to many open files
// https://github.com/phosphor-icons/react/issues/45
import { ArrowUp } from '@phosphor-icons/react/dist/csr/ArrowUp';

interface SuggestionButtonsProps {
  chatStarted: boolean;
  onSuggestionClick?: (suggestion: string) => void;
}

export const SuggestionButtons = ({ chatStarted, onSuggestionClick }: SuggestionButtonsProps) => {
  if (chatStarted) {
    return null;
  }

  const suggestions = [
    {
      title: 'Build a chat app',
      prompt:
        'Build a simple chat app with threads and reactions. There should be a nice UI to send messages, add/view threads, and react to messages. Reactions should include a heart, a thumbs up, and a thumbs down and should be shown with a number',
    },
    {
      title: 'Build a todo app',
      prompt:
        'Build a Todo app with two different tabs, "To Do" and "Done". Add the ability to add tags to a task when creating it and filter tasks by tag',
    },
    {
      title: 'Build a Bluesky clone',
      prompt: 'Build a Bluesky clone with a feed of posts, post likes, and the ability to upload images',
    },
  ];

  return (
    <div id="suggestions" className="flex flex-col justify-center items-center">
      <div className="flex gap-6">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.title}
            onClick={() => onSuggestionClick?.(suggestion.prompt)}
            className="flex gap-1 items-center rounded-full px-3 py-1 border border-bolt-elements-borderColor bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
          >
            <ArrowUp className="size-4" />
            {suggestion.title}
          </button>
        ))}
      </div>
    </div>
  );
};
