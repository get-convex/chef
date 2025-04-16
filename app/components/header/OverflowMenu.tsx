import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import { FeedbackButton } from './FeedbackButton';

export function OverflowMenu() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center rounded-md bg-bolt-elements-item-backgroundDefault p-1 text-sm text-content-primary hover:bg-bolt-elements-item-backgroundActive hover:text-content-primary">
          <DotsHorizontalIcon />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[200px] animate-fadeIn rounded-md border border-gray-200 bg-bolt-elements-background-depth-1 shadow-lg dark:border-gray-800"
          sideOffset={5}
          align="end"
        >
          <div className="p-1">
            <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm text-bolt-elements-item-contentDefault outline-0 hover:bg-bolt-elements-item-backgroundActive hover:text-bolt-elements-item-contentActive">
              <FeedbackButton />
            </DropdownMenu.Item>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
