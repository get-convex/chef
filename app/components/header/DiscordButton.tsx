import { DiscordLogoIcon } from '@radix-ui/react-icons';
import { Button } from '@ui/Button';
import { MenuItem } from '@ui/Menu';

export function DiscordButton({ showInMenu }: { showInMenu: boolean }) {
  const handleDiscordClick = () => {
    window.open('https://discord.com/channels/1019350475847499849/1361433860558032906', '_blank');
  };

  if (showInMenu) {
    return (
      <MenuItem action={handleDiscordClick}>
        {/* Margin top is needed to visually align the icon with the text */}
        <DiscordLogoIcon className="text-content-secondary" style={{ marginTop: '3px' }} />
        <span>Community Support</span>
      </MenuItem>
    );
  }
  return (
    <Button
      variant="neutral"
      size="xs"
      className="hidden sm:flex"
      onClick={handleDiscordClick}
      icon={<DiscordLogoIcon />}
    >
      Community Support
    </Button>
  );
}
