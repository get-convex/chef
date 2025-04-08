import type { Tool } from 'ai';
import { z } from 'zod';

const fileReplaceStringToolDescription = `
Replace a string of text that appears exactly once in a file with a
new string of text. Use this tool when fixing a bug or making a
small tweak to a file.

You MUST know a file's current contents before using this tool. This may
either be from context or previous use of the \`view\` tool.

The \`old_content\` and \`new_content\` parameters must be less than 1024 characters each.
`;

export const fileReplaceStringToolParameters = z.object({
  absolute_path: z.string().describe('The absolute path to the file to edit.'),
  old_content: z.string().describe('The fragment of text to replace. Must be less than 1024 characters.'),
  new_content: z.string().describe('The new fragment of text to replace it with. Must be less than 1024 characters.'),
});

export const fileReplaceStringTool: Tool = {
  description: fileReplaceStringToolDescription,
  parameters: fileReplaceStringToolParameters,
};
