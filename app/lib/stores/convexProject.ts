import { atom } from 'nanostores';

export type ConvexProject = {
  token: string;
  deploymentName: string;
  deploymentUrl: string;
  projectSlug: string;
  teamSlug: string;
};

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
