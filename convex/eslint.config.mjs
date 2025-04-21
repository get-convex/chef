import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import convexPlugin from "@convex-dev/eslint-plugin";

export default [
  {
    ignores: ["**/dist", "**/node_modules", "convex/_generated/**"],
  },
  ...convexPlugin.configs.recommended,
  {
    files: ["**/*.ts"],
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-this-alias": "off",
      "array-bracket-spacing": ["error", "never"],
      "object-curly-newline": ["error", { consistent: true }],
      "keyword-spacing": ["error", { before: true, after: true }],
      "consistent-return": "error",
      semi: ["error", "always"],
      curly: ["error"],
      "no-eval": ["error"],
      "linebreak-style": ["error", "unix"],
      "arrow-spacing": ["error", { before: true, after: true }],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../"],
              message: "Relative imports are not allowed. Please use '~/' instead.",
            },
          ],
        },
      ],
    },
  },
];
