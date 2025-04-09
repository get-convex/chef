import { useStore } from '@nanostores/react';
import { atom } from 'nanostores';
import { getLocalStorage, setLocalStorage } from '~/lib/persistence';

export type ConvexTeam = {
  id: string;
  name: string;
  slug: string;
};

export const convexTeamsStore = atom<ConvexTeam[] | null>(null);

const SELECTED_TEAM_SLUG_KEY = 'selectedConvexTeamSlug';
export const selectedTeamSlugStore = atom<string | null>(null);

export function getStoredTeamSlug(): string | null {
  return getLocalStorage(SELECTED_TEAM_SLUG_KEY);
}

export function setSelectedTeamSlug(teamSlug: string | null) {
  setLocalStorage(SELECTED_TEAM_SLUG_KEY, teamSlug);
  selectedTeamSlugStore.set(teamSlug);
}

export function useSelectedTeamSlug(): string | null {
  const selectedTeamSlug = useStore(selectedTeamSlugStore);
  return selectedTeamSlug;
}

export async function waitForSelectedTeamSlug(caller?: string): Promise<string> {
  return new Promise((resolve) => {
    const selectedTeamSlug = selectedTeamSlugStore.get();
    if (selectedTeamSlug !== null) {
      resolve(selectedTeamSlug);
      return;
    }
    if (caller) {
      console.log(`[${caller}] Waiting for selected team slug...`);
    }
    const unsubscribe = selectedTeamSlugStore.subscribe((selectedTeamSlug) => {
      if (selectedTeamSlug !== null) {
        unsubscribe();
        resolve(selectedTeamSlug);
      }
    });
  });
}
