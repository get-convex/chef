import { useStore } from '@nanostores/react';
import { atom } from 'nanostores';
import { chatSyncState } from './startup/chatSyncState';

export const subchatIndexStore = atom<number | undefined>(undefined);
export const subchatLoadedStore = atom<boolean>(false);

export function useIsSubchatLoaded() {
  const subchatIndex = useStore(subchatIndexStore);
  const syncState = useStore(chatSyncState);

  return syncState.subchatIndex === subchatIndex;
}

export async function waitForSubchatIndexChanged(subchatIndex: number) {
  return new Promise<void>((resolve) => {
    if (subchatIndexStore.get() !== subchatIndex) {
      resolve();
      return;
    }
    subchatIndexStore.listen((newSubchatIndex) => {
      if (subchatIndex !== undefined && newSubchatIndex !== subchatIndex) {
        resolve();
      }
    });
  });
}
