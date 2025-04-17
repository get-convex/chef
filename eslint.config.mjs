import blitzPlugin from '@blitz/eslint-plugin';
import { jsFileExtensions } from '@blitz/eslint-plugin/dist/configs/javascript.js';
import { getNamingConventionRule, tsFileExtensions } from '@blitz/eslint-plugin/dist/configs/typescript.js';
import tailwindcss from "eslint-plugin-tailwindcss";
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['**/dist', '**/node_modules', '**/.wrangler', '**/bolt/build', '**/.history', 'template/**'],
  },
  ...blitzPlugin.configs.recommended(),
  {
    files: [...tsFileExtensions, ...jsFileExtensions],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactPlugin.configs.flat['jsx-runtime'].rules,
      
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
      "prefer-arrow-callback": [
        'error',
        {
          allowNamedFunctions: true,
        },
      ],
      'tailwindcss/classnames-order': 'off',
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
          paths: [{
            name: 'sonner',
            importNames: ['Toaster'],
            message: "Please import Toaster from '~/components/ui/Toaster' instead of 'sonner'."
          }]
        },
      ],
    },
  },
  ...tailwindcss.configs["flat/recommended"],
  {
    files: ['**/*.tsx'],
    plugins: {
      tailwindcss,
    },
    rules: {
      'tailwindcss/no-custom-classname': ['error', {
        whitelist: ['sentry-mask']
      }],
    },
  },
];
