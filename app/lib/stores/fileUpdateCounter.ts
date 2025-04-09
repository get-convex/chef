import { useStore } from '@nanostores/react';
import { atom } from 'nanostores';
import { IGNORED_PATHS } from '~/utils/constants';

const fileUpdateCounter = atom(0);

let currentTimer: NodeJS.Timeout | null = null;
let lastUpdated = 0;
const DEBOUNCE_TIME = 1000;

export function useFileUpdateCounter() {
  return useStore(fileUpdateCounter);
}

export function getFileUpdateCounter() {
  return fileUpdateCounter.get();
}

export async function waitForFileUpdateCounterChanged(counter: number) {
  return new Promise<void>((resolve) => {
    if (getFileUpdateCounter() !== counter) {
      resolve();
      return;
    }
    fileUpdateCounter.listen((newCounter) => {
      if (newCounter !== counter) {
        resolve();
      }
    });
  });
}

export function incrementFileUpdateCounter(path: string) {
  if (IGNORED_PATHS.some((p) => path.startsWith(p))) {
    return;
  }
  if (currentTimer) {
    return;
  }
  const now = Date.now();
  const nextUpdate = lastUpdated + DEBOUNCE_TIME;
  if (now < nextUpdate) {
    currentTimer = setTimeout(update, nextUpdate - now);
    return;
  }
  update();
}

function update() {
  fileUpdateCounter.set(fileUpdateCounter.get() + 1);
  lastUpdated = Date.now();
  currentTimer = null;
}
