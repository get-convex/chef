import { useStore } from '@nanostores/react';
// eslint-disable-next-line no-restricted-imports
import { Toaster as SonnerToaster } from 'sonner';
import { themeStore } from '~/lib/stores/theme';

export function Toaster() {
  const theme = useStore(themeStore);
  return <SonnerToaster position="bottom-right" closeButton richColors theme={theme} />;
}
