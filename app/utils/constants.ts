import { LLMManager } from '~/lib/modules/llm/manager';

export const WORK_DIR_NAME = 'project';
export const WORK_DIR = `/home/${WORK_DIR_NAME}`;
export const DEFAULT_MODEL = 'claude-3-5-sonnet-latest';
export const PROMPT_COOKIE_KEY = 'cachedPrompt';

const llmManager = LLMManager.getInstance(import.meta.env);

export const PROVIDER_LIST = llmManager.getAllProviders();
export const DEFAULT_PROVIDER = llmManager.getDefaultProvider();

const providerBaseUrlEnvKeys: Record<string, { baseUrlKey?: string; apiTokenKey?: string }> = {};
PROVIDER_LIST.forEach((provider) => {
  providerBaseUrlEnvKeys[provider.name] = {
    baseUrlKey: provider.config.baseUrlKey,
    apiTokenKey: provider.config.apiTokenKey,
  };
});

export const PREWARM_PATHS = [`${WORK_DIR}/package.json`, `${WORK_DIR}/convex/schema.ts`, `${WORK_DIR}/src/App.tsx`];

export const EXECUTABLES = [
  '/home/project/node_modules/@babel/parser/bin/babel-parser.js',
  '/home/project/node_modules/@typescript-eslint/typescript-estree/node_modules/semver/bin/semver.js',
  '/home/project/node_modules/acorn/bin/acorn',
  '/home/project/node_modules/autoprefixer/bin/autoprefixer',
  '/home/project/node_modules/convex/bin/main.js',
  '/home/project/node_modules/convex/node_modules/prettier/bin/prettier.cjs',
  '/home/project/node_modules/cssesc/bin/cssesc',
  '/home/project/node_modules/esbuild/bin/esbuild',
  '/home/project/node_modules/eslint/bin/eslint.js',
  '/home/project/node_modules/js-yaml/bin/js-yaml.js',
  '/home/project/node_modules/jsesc/bin/jsesc',
  '/home/project/node_modules/nanoid/bin/nanoid.cjs',
  '/home/project/node_modules/normalize-package-data/node_modules/semver/bin/semver',
  '/home/project/node_modules/npm-run-all/bin/npm-run-all/index.js',
  '/home/project/node_modules/pidtree/bin/pidtree.js',
  '/home/project/node_modules/prettier/bin/prettier.cjs',
  '/home/project/node_modules/resolve/bin/resolve',
  '/home/project/node_modules/rollup/dist/bin/rollup',
  '/home/project/node_modules/semver/bin/semver.js',
  '/home/project/node_modules/sucrase/bin/sucrase',
  '/home/project/node_modules/typescript/bin/tsc',
  '/home/project/node_modules/typescript/bin/tsserver',
  '/home/project/node_modules/vite/bin/vite.js',
  '/home/project/node_modules/which/bin/node-which',
];
