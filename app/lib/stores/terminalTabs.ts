import { atom } from 'nanostores';

export const VITE_TAB_INDEX = 0;
export const CONVEX_DEPLOY_TAB_INDEX = 1;

export const activeTerminalTab = atom(0);
export const isConvexDeployTerminalVisible = atom(false);
