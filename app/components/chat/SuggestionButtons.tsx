import { Button } from '@ui/Button';
import { ArrowUpIcon } from '@radix-ui/react-icons';
import { SUGGESTIONS } from 'chef-agent/constants.js';

interface SuggestionButtonsProps {
  chatStarted: boolean;
  onSuggestionClick?: (suggestion: string) => void;
  disabled?: boolean;
}

export const SuggestionButtons = ({ chatStarted, onSuggestionClick, disabled }: SuggestionButtonsProps) => {
  if (chatStarted) {
    return null;
  }

  return (
    <div id="suggestions">
      <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-4">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion.title}
            onClick={() => onSuggestionClick?.(suggestion.prompt)}
            className="rounded-full px-3"
            variant="neutral"
            disabled={disabled}
            icon={<ArrowUpIcon className="size-4" />}
          >
            {suggestion.title}
          </Button>
        ))}
      </div>
    </div>
  );
};
