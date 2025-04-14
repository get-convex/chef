import { useStore } from '@nanostores/react';
import { memo, useEffect, useState } from 'react';
import { themeStore, toggleTheme } from '~/lib/stores/theme';
import { IconButton } from './IconButton';
import { SunIcon, MoonIcon } from '@radix-ui/react-icons';

interface ThemeSwitchProps {
  className?: string;
}

export const ThemeSwitch = memo(({ className }: ThemeSwitchProps) => {
  const theme = useStore(themeStore);
  const [domLoaded, setDomLoaded] = useState(false);

  useEffect(() => {
    setDomLoaded(true);
  }, []);

  return (
    domLoaded && (
      <IconButton
        className={className}
        size="xl"
        title="Toggle Theme"
        onClick={toggleTheme}
        icon={theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      />
    )
  );
});
