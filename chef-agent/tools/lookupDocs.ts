import type { Tool } from 'ai';
import { proseMirrorComponentReadmePrompt } from 'chef-agent/prompts/proseMirrorComponentReadme';
import { z } from 'zod';

export const lookupDocsParameters = z.object({
  docs: z.array(z.string()).describe('List of features to look up in the documentation'),
});

export const lookupDocsTool: Tool = {
  description: 'Lookup documentation for a list of features. Valid features to lookup are: `proseMirror`',
  parameters: lookupDocsParameters,
};

export type LookupDocsParameters = z.infer<typeof lookupDocsParameters>;

// Documentation content that can be looked up
export const docs = {
  proseMirror: proseMirrorComponentReadmePrompt,
} as const;

export type DocKey = keyof typeof docs;
