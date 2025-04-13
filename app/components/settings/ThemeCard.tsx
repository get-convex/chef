import { useStore } from '@nanostores/react';
import { toggleTheme } from '~/lib/stores/theme';
import { themeStore } from '~/lib/stores/theme';

export function ThemeCard() {
  const theme = useStore(themeStore);
  return (
    <div className="bg-bolt-elements-background-depth-1 rounded-lg shadow-sm border border-bolt-elements-borderColor">
      <div className="p-6">
        <h2 className="text-xl font-semibold text-bolt-elements-textPrimary mb-4">Appearance</h2>
        <div className="flex items-center justify-between">
          <span className="text-bolt-elements-textSecondary">Theme</span>
          <button
            onClick={() => toggleTheme()}
            className="px-4 py-2 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text rounded-lg transition-colors"
          >
            {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
          </button>
        </div>
      </div>
    </div>
  );
}
