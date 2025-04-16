import { useStore } from '@nanostores/react';
import { memo, useEffect, useState } from 'react';
import { themeStore, toggleTheme } from '~/lib/stores/theme';
import { SunIcon, MoonIcon } from '@radix-ui/react-icons';
import { Button } from '@ui/Button';

interface ThemeSwitchProps {
  className?: string;
}

export const ThemeSwitch = memo(function ThemeSwitch({ className }: ThemeSwitchProps) {
  const theme = useStore(themeStore);
  const [domLoaded, setDomLoaded] = useState(false);

  useEffect(() => {
    setDomLoaded(true);
  }, []);

  return (
    domLoaded && (
      <Button
        variant="neutral"
        inline
        aria-label="Toggle Theme"
        className={className}
        onClick={toggleTheme}
        tip={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        tipSide="right"
        icon={theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      />
    )
  );
});
