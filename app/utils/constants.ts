import { WORK_DIR } from 'chef-agent/constants';

export const PROMPT_COOKIE_KEY = 'cachedPrompt';

export const IGNORED_PATHS = [`${WORK_DIR}/dist/`, `${WORK_DIR}/node_modules/`, `${WORK_DIR}/.env.local`];
export const IGNORED_RELATIVE_PATHS = ['dist', 'node_modules', '.env.local'];

export const DEFAULT_COLLAPSED_FOLDERS = new Set([
  `${WORK_DIR}/convex/_generated`,
  `${WORK_DIR}/public`,
  `${WORK_DIR}/src/components`,
  `${WORK_DIR}/src/hooks`,
  `${WORK_DIR}/src/lib`,
]);

const MIN_BACKOFF = 500;
const MAX_BACKOFF = 60000;

export function backoffTime(numFailures: number) {
  return Math.min(MIN_BACKOFF * Math.pow(2, numFailures), MAX_BACKOFF) * Math.random();
}

// These are the user facing options for the model selector, which the
// client then maps to the model provider used by the backend. For
// example, the user may specify "claude-4-sonnet", but then we'll
// fallback between Anthropic and Bedrock.
export type ModelSelection =
  | 'auto'
  | 'claude-3-5-haiku'
  | 'claude-4-sonnet'
  | 'claude-4.5-sonnet'
  | 'gpt-4.1'
  | 'gpt-4.1-mini'
  | 'gpt-5'
  | 'grok-3-mini'
  | 'grok-free'
  | 'gemini-2.5-pro'
  | 'qwen-coder'
  | 'qwen-2.5-coder-32b'
  | 'gemini-2.0-flash-exp'
  | 'deepseek-coder'
  | 'llama-3.3-70b'
  | 'codestral-latest'
  | 'nemotron-nano-9b-v2'
  | 'kimi-k2'
  | 'devstral-small-2505'
  | 'mai-ds-r1';

export const MAX_CONSECUTIVE_DEPLOY_ERRORS = 5;
