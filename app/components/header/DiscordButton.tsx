import { DiscordLogoIcon } from '@radix-ui/react-icons';
import { OverflowMenuButton } from './OverflowMenuButton';

export function DiscordButton() {
  const handleDiscordClick = () => {
    window.open('https://discord.com/channels/1019350475847499849/1361433860558032906', '_blank');
  };

  return (
    <OverflowMenuButton onClick={handleDiscordClick}>
      {/* Margin top is needed to visually align the icon with the text */}
      <DiscordLogoIcon style={{ marginTop: '3px' }} />
      <span>Community Support</span>
    </OverflowMenuButton>
  );
}
