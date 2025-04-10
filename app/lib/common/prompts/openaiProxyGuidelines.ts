import { stripIndents } from '~/utils/stripIndent';
import type { SystemPromptOptions } from './types';

export function openaiProxyGuidelines(options: SystemPromptOptions) {
  if (!options.openaiProxyEnabled) {
    return '';
  }
  return stripIndents`
  <bundled_openai_guidelines>
    Apps in the Chef environment come with a small amount of gpt-4o-mini
    tokens to use for building apps! Use this model in creative ways.

    The environment provides the \`CONVEX_OPENAI_API_KEY\` and
    \`CONVEX_OPENAI_BASE_URL\` environment variables. Install the
    \`openai\` NPM package, and use them in an action like this:

    \`\`\`ts
    import OpenAI from "openai";
    import { action } from "./_generated/server";

    const openai = new OpenAI({
      baseURL: process.env.CONVEX_OPENAI_BASE_URL,
      apiKey: process.env.CONVEX_OPENAI_API_KEY,
    });

    export const exampleAction = action({
      args: {
        prompt: v.string(),
      },
      handler: async (ctx, args) => {
        const resp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: args.prompt }],
        });
        return resp.choices[0].message.content;
      },
    });
    \`\`\`

    You can ONLY use the chat completions API, and gpt-4o-mini is the ONLY
    supported model. If you need different APIs or models, ask the user
    to set up their own OpenAI API key.

    If the user has already set up their own OpenAI API key, prefer using
    that over the builtin Convex one.
  </bundled_openai_guidelines>
  `;
}
