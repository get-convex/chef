import { atom } from 'nanostores';
import { workbenchStore } from './workbench.client';

export const dashboardPathStore = atom<string>('data');

export function setDashboardPath(path: string) {
  dashboardPathStore.set(path);
}

export function openDashboardToPath(path: string) {
  setDashboardPath(path);
  workbenchStore.showWorkbench.set(true);
  workbenchStore.currentView.set('dashboard');
}
