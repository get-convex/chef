import { Button } from '@ui/Button';
import { ArrowUpIcon, StarIcon } from '@radix-ui/react-icons';
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

      <div className="mt-6 flex justify-center">
        <Button
          href="https://stack.convex.dev/chef-cookbook-tips-working-with-ai-app-builders"
          target="_blank"
          rel="noopener noreferrer"
          variant="neutral"
          className="items-center px-3 rounded-full bg-[#F5F5D3] text-[#EE352F] border-[#EE352F] hover:bg-[#FDEFD2]"
        >
          <img src="/tips_chef_hat.svg" className="size-5"/>
          <span>Tips for building with Chef</span>
        </Button>
      </div>
    </div>
  );
};
