import { DiscordLogoIcon } from '@radix-ui/react-icons';
import { MenuItem } from '@ui/Menu';

export function DiscordButton() {
  const handleDiscordClick = () => {
    window.open('https://discord.com/channels/1019350475847499849/1361433860558032906', '_blank');
  };

  return (
    <MenuItem action={handleDiscordClick}>
      {/* Margin top is needed to visually align the icon with the text */}
      <DiscordLogoIcon style={{ marginTop: '3px' }} />
      <span>Community Support</span>
    </MenuItem>
  );
}
