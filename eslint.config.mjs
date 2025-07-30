import blitzPlugin from '@blitz/eslint-plugin';
import { jsFileExtensions } from '@blitz/eslint-plugin/dist/configs/javascript.js';
import { getNamingConventionRule, tsFileExtensions } from '@blitz/eslint-plugin/dist/configs/typescript.js';
import tailwindcss from 'eslint-plugin-tailwindcss';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import noGlobalFetchRule from './eslint-rules/no-global-fetch.js';

const noDirectProcessEnv = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct process.env usage',
      category: 'Best Practices',
    },
    fixable: null,
    schema: [],
    messages: {
      noDirectProcessEnv:
        'Direct process.env usage is not allowed. Use globalThis.process.env instead because process.env is shimmed in for both the browser and the server.',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (node.object.name === 'process' && node.property.name === 'env') {
          context.report({
            node,
            messageId: 'noDirectProcessEnv',
          });
        }
      },
    };
  },
};

export default [
  {
    ignores: [
      '**/dist',
      '**/node_modules',
      '**/.wrangler',
      '**/bolt/build',
      '**/.history',
      'template/**',
      '**/*.bundled.*',
    ],
  },
  ...blitzPlugin.configs.recommended(),
  {
    files: [...tsFileExtensions, ...jsFileExtensions],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      local: {
        rules: {
          'no-direct-process-env': noDirectProcessEnv,
        },
      },
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactPlugin.configs.flat['jsx-runtime'].rules,
      ...reactHooksPlugin.configs.recommended.rules,

      '@blitz/lines-around-comment': 'off',
      '@blitz/newline-before-return': 'off',
      '@blitz/catch-error-name': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/naming-convention': 'off',
      // turn off all five custom rules
      '@blitz/catch-error-name': 'off',
      '@blitz/comment-syntax': 'off',
      '@blitz/block-scope-case': 'off',
      '@blitz/lines-around-comment': 'off',
      '@blitz/newline-before-return': 'off',
      'array-bracket-spacing': ['error', 'never'],
      'padding-line-between-statements': 'off',
      'multiline-comment-style': 'off',
      'object-curly-newline': ['error', { consistent: true }],
      'keyword-spacing': ['error', { before: true, after: true }],
      'consistent-return': 'error',
      semi: ['error', 'always'],
      curly: ['error'],
      'no-eval': ['error'],
      'linebreak-style': ['error', 'unix'],
      'arrow-spacing': ['error', { before: true, after: true }],
      'multiline-comment-style': 'off',
      'padding-line-between-statements': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error', // or 'warn' if you prefer
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports', // This is the default, enforces 'import type'
          fixStyle: 'separate-type-imports', // This is also the default, enforces 'import type { Foo }'
        },
      ],
      'prefer-arrow-callback': [
        'error',
        {
          allowNamedFunctions: true,
        },
      ],
      'tailwindcss/classnames-order': 'off',
      'no-restricted-syntax': [
        'error',
        {
          message: '.bottom-4 is blocked on convex.dev by easylist_cookie; use .bottom-four instead',
          selector: 'Literal[value=/bottom-4(?:\\D|$)/i]',
        },
      ],
      // Don't allow direct process.env usage
      'local/no-direct-process-env': 'error',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: ['**/*.tsx'],
    rules: {
      ...getNamingConventionRule({}, true),
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    files: [...tsFileExtensions, ...jsFileExtensions, '**/*.tsx'],
    ignores: ['functions/*'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../'],
              message: "Relative imports are not allowed. Please use '~/' instead.",
            },
          ],
          paths: [
            {
              name: 'sonner',
              importNames: ['Toaster'],
              message: "Please import Toaster from '~/components/ui/Toaster' instead of 'sonner'.",
            },
          ],
        },
      ],
    },
  },
  ...tailwindcss.configs['flat/recommended'],
  {
    files: ['**/*.tsx'],
    plugins: {
      tailwindcss,
    },
    rules: {
      'tailwindcss/no-custom-classname': [
        'error',
        {
          whitelist: ['sentry-mask'],
        },
      ],
    },
  },
  {
    files: ['app/lib/.server/llm/provider.ts', 'app/lib/.server/chat.ts'],
    plugins: {
      custom: {
        rules: {
          'no-global-fetch': noGlobalFetchRule,
        },
      },
    },
    rules: {
      'custom/no-global-fetch': 'error',
    },
  },
];
