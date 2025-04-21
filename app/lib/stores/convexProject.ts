import { atom } from 'nanostores';
import type { ConvexProject } from 'chef-agent/types';

export const convexProjectStore = atom<ConvexProject | null>(null);

export function waitForConvexProjectConnection(): Promise<ConvexProject> {
  return new Promise((resolve) => {
    if (convexProjectStore.get() !== null) {
      resolve(convexProjectStore.get()!);
      return;
    }

    const unsubscribe = convexProjectStore.subscribe((project) => {
      if (project !== null) {
        unsubscribe();
        resolve(project);
      }
    });
  });
}
