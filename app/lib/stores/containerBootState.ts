import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';

export enum ContainerBootState {
  ERROR = -1,

  STARTING = 0,
  LOADING_SNAPSHOT = 1,
  SETTING_UP_CONVEX_PROJECT = 2,
  SETTING_UP_CONVEX_ENV_VARS = 3,
  CONFIGURING_CONVEX_AUTH = 4,
  READY = 5,
}

const containerBootStore = atom<{ state: ContainerBootState; startTime: number; errorToLog?: Error }>({
  state: ContainerBootState.STARTING,
  startTime: Date.now(),
});

export function useContainerBootState() {
  return useStore(containerBootStore);
}

export function setContainerBootState(state: ContainerBootState, error?: Error) {
  const existing = containerBootStore.get();
  const msg = `Container boot [${(Date.now() - existing.startTime).toFixed(2)}ms]`;
  if (error) {
    console.error(msg, ContainerBootState[state], error);
  } else {
    console.log(msg, ContainerBootState[state]);
  }
  error = error ?? existing.errorToLog;
  containerBootStore.set({ ...existing, state, errorToLog: error });
}

export function takeContainerBootError() {
  const existing = containerBootStore.get();
  if (existing.state !== ContainerBootState.ERROR) {
    throw new Error('Container boot state is not in error');
  }
  const { errorToLog: _, ...rest } = existing;
  containerBootStore.set(rest);
}

export function waitForBootStepCompleted(step: ContainerBootState) {
  return waitForContainerBootState(step + 1);
}

export function waitForContainerBootState(minState: ContainerBootState) {
  return new Promise((resolve, reject) => {
    const result = containerBootStore.get();
    if (result.state === ContainerBootState.ERROR) {
      reject(result.errorToLog);
      return;
    }
    if (result.state >= minState) {
      resolve(result);
      return;
    }
    const unsubscribe = containerBootStore.subscribe((result) => {
      if (result.state >= minState) {
        unsubscribe();
        resolve(result);
      }
      if (result.state === ContainerBootState.ERROR) {
        unsubscribe();
        reject(result.errorToLog);
      }
    });
  });
}
