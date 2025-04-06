import { stripIndents } from '~/utils/stripIndent';
import type { SystemPromptOptions } from './types';

export function bundledOpenAIGuidelines(_options: SystemPromptOptions) {
  return stripIndents`
  <bundled_openai_guidelines>
    Apps in the Chef environment come with a small amount of OpenAI
    credits to use for building apps!

    The environment provides the \`CONVEX_OPENAI_API_KEY\` and
    \`CONVEX_OPENAI_BASE_URL\` environment variables. Install the
    \`openai\` NPM package, and here's how to use it in an action:

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

    You can ONLY use the chat completions API, and gpt-4o-min is the ONLY
    supported model. If you need different APIs or models, ask the user
    to set up their own OpenAI API key.
  </bundled_openai_guidelines>
  `;
}