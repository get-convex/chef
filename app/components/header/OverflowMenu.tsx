import {  DotsVerticalIcon } from '@radix-ui/react-icons';
import { FeedbackButton } from './FeedbackButton';
import { DiscordButton } from './DiscordButton';
import { Menu } from '@ui/Menu';

export function OverflowMenu() {
  return (
    <Menu buttonProps={{ variant: "neutral", icon: <DotsVerticalIcon /> }} placement="bottom-start">
        <FeedbackButton />
        <DiscordButton />
    </Menu>
  )
}
