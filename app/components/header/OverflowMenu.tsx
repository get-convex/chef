import { DotsVerticalIcon } from '@radix-ui/react-icons';
import { FeedbackButton } from './FeedbackButton';
import { DiscordButton } from './DiscordButton';
import { Menu } from '@ui/Menu';

export function OverflowMenu({ chatStarted }: { chatStarted: boolean }) {
  if (!chatStarted) {
    return (
      <>
        <FeedbackButton chatStarted={chatStarted} />
        <DiscordButton chatStarted={chatStarted} />
      </>
    );
  }
  return (
    <Menu buttonProps={{ variant: 'neutral', icon: <DotsVerticalIcon /> }} placement="bottom-start">
      <FeedbackButton chatStarted={chatStarted} />
      <DiscordButton chatStarted={chatStarted} />
    </Menu>
  );
}
