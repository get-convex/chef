import { useStore } from '@nanostores/react';
import { toggleTheme } from '~/lib/stores/theme';
import { themeStore } from '~/lib/stores/theme';

export function ThemeCard() {
  const theme = useStore(themeStore);
  return (
    <div className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 shadow-sm">
      <div className="p-6">
        <h2 className="mb-4 text-xl font-semibold text-bolt-elements-textPrimary">Appearance</h2>
        <div className="flex items-center justify-between">
          <span className="text-bolt-elements-textSecondary">Theme</span>
          <button
            onClick={() => toggleTheme()}
            className="rounded-lg bg-bolt-elements-button-primary-background px-4 py-2 text-bolt-elements-button-primary-text transition-colors hover:bg-bolt-elements-button-primary-backgroundHover"
          >
            {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
          </button>
        </div>
      </div>
    </div>
  );
}
