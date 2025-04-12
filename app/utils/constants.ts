export const WORK_DIR_NAME = 'project';
export const WORK_DIR = `/home/${WORK_DIR_NAME}`;
export const PROMPT_COOKIE_KEY = 'cachedPrompt';

export const PREWARM_PATHS = [`${WORK_DIR}/package.json`, `${WORK_DIR}/convex/schema.ts`, `${WORK_DIR}/src/App.tsx`];

export const IGNORED_PATHS = [`${WORK_DIR}/dist/`, `${WORK_DIR}/node_modules/`, `${WORK_DIR}/.env.local`];
export const IGNORED_RELATIVE_PATHS = ['dist', 'node_modules', '.env.local'];

export const DEFAULT_COLLAPSED_FOLDERS = new Set([
  `${WORK_DIR}/convex/_generated`,
  `${WORK_DIR}/public`,
  `${WORK_DIR}/src/components`,
  `${WORK_DIR}/src/hooks`,
  `${WORK_DIR}/src/lib`,
]);

export const MIN_BACKOFF = 500;
export const MAX_BACKOFF = 60000;

export function backoffTime(numFailures: number) {
  return Math.min(MIN_BACKOFF * Math.pow(2, numFailures), MAX_BACKOFF) * Math.random();
}

// These are the user facing options for the model selector, which the
// client then maps to the model provider used by the backend. For
// example, the user may specify "claude-3.5-sonnet", but then we'll
// fallback between Anthropic and Bedrock.
export type ModelSelection = 'auto' | 'claude-3.5-sonnet' | 'gpt-4o-optimus';