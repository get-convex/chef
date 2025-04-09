export const WORK_DIR_NAME = 'project';
export const WORK_DIR = `/home/${WORK_DIR_NAME}`;
export const PROMPT_COOKIE_KEY = 'cachedPrompt';

export const PREWARM_PATHS = [`${WORK_DIR}/package.json`, `${WORK_DIR}/convex/schema.ts`, `${WORK_DIR}/src/App.tsx`];

export const MIN_BACKOFF = 500;
export const MAX_BACKOFF = 60000;

export function backoffTime(numFailures: number) {
  return Math.min(MIN_BACKOFF * Math.pow(2, numFailures), MAX_BACKOFF) * Math.random();
}
