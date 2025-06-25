import { Button } from '@ui/Button';
import { ArrowUpIcon, VideoIcon } from '@radix-ui/react-icons';
import { SUGGESTIONS } from 'chef-agent/constants';

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
      <div className="mt-6 flex flex-wrap justify-center gap-4">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion.title}
            onClick={() => onSuggestionClick?.(suggestion.prompt)}
            className="rounded-full px-3 shadow-sm"
            variant="neutral"
            disabled={disabled}
            icon={<ArrowUpIcon className="size-4" />}
          >
            {suggestion.title}
          </Button>
        ))}
      </div>

      <div className="mt-4 flex justify-center">
        <Button
          href="https://www.youtube.com/watch?v=kvB1bVTIfks"
          target="_blank"
          variant="neutral"
          className="items-center rounded-full border-[#EE352F] bg-[#FEF4E2] fill-[#EE342F] px-3 text-[#EE352F] shadow-sm hover:bg-[#FDEFD2] dark:border-[#FFD700] dark:bg-[#2F2917] dark:fill-[#FFD700] dark:text-[#FFD700] dark:hover:bg-[#3F3920]"
          icon={<VideoIcon />}
        >
          <span>Tips for building with Chef</span>
        </Button>
      </div>
    </div>
  );
};
