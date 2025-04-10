import type { Id } from '@convex/_generated/dataModel';
import { useStore } from '@nanostores/react';
import { atom } from 'nanostores';

export function useConvexSessionIdOrNullOrLoading(): Id<'sessions'> | null | undefined {
  const sessionId = useStore(sessionIdStore);
  return sessionId;
}

export function useConvexSessionId(): Id<'sessions'> {
  const sessionId = useStore(sessionIdStore);
  if (sessionId === undefined || sessionId === null) {
    throw new Error('Session ID is not set');
  }
  return sessionId;
}

export async function waitForConvexSessionId(caller?: string): Promise<Id<'sessions'>> {
  return new Promise((resolve) => {
    const sessionId = sessionIdStore.get();
    if (sessionId !== null && sessionId !== undefined) {
      resolve(sessionId);
      return;
    }
    if (caller) {
      console.log(`[${caller}] Waiting for session ID...`);
    }
    const unsubscribe = sessionIdStore.subscribe((sessionId) => {
      if (sessionId !== null && sessionId !== undefined) {
        unsubscribe();
        resolve(sessionId);
      }
    });
  });
}

export const sessionIdStore = atom<Id<'sessions'> | null | undefined>(undefined);
