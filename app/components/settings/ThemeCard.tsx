import { useStore } from '@nanostores/react';
import { Button } from '@ui/Button';
import { toggleTheme } from '~/lib/stores/theme';
import { themeStore } from '~/lib/stores/theme';

export function ThemeCard() {
  const theme = useStore(themeStore);
  return (
    <div className="rounded-lg border bg-bolt-elements-background-depth-1 shadow-sm">
      <div className="p-6">
        <h2 className="mb-4 text-xl font-semibold text-content-primary">Appearance</h2>
        <div className="flex items-center justify-between">
          <span className="text-content-secondary">Theme</span>

          <Button onClick={() => toggleTheme()}>{theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}</Button>
        </div>
      </div>
    </div>
  );
}
