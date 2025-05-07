// @ts-check
/**
 * @type {import('eslint').Rule.RuleModule}
 */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow use of global fetch, require undiciFetch or fetch imported from undici or ~/lib/.server/fetch',
      category: 'Best Practices',
      recommended: false,
    },
    messages: {
      noGlobalFetch:
        "Do not use the global fetch for streaming with the Vercel AI SDK, it doesn't work with Vercel + Remix + Vercel AI SDK as we have it configured. Use undiciFetch or fetch imported from undici or ~/lib/.server/fetch instead. See https://github.com/vercel/ai/issues/199#issuecomment-1605245593",
    },
    schema: [],
  },
  create(context) {
    let allowedFetchNames = new Set();

    return {
      ImportDeclaration(node) {
        if (node.source.value === 'undici' || node.source.value === '~/lib/.server/fetch') {
          for (const spec of node.specifiers) {
            if (
              spec.type === 'ImportSpecifier' &&
              spec.imported.type === 'Identifier' &&
              (spec.imported.name === 'fetch' || spec.imported.name === 'undiciFetch')
            ) {
              allowedFetchNames.add(spec.local.name);
            }
          }
        }
      },
      Identifier(node) {
        if (
          node.name === 'fetch' &&
          !allowedFetchNames.has('fetch') &&
          node.parent &&
          node.parent.type !== 'ImportSpecifier' &&
          node.parent.type !== 'ImportDeclaration'
        ) {
          context.report({
            node,
            messageId: 'noGlobalFetch',
          });
        }
      },
    };
  },
};

export default rule;
