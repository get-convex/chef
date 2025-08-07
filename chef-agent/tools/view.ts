import type { Tool } from 'ai';
import { z } from 'zod';

const viewRangeDescription = `
An optional array of two numbers specifying the inclusive start and exclusive end line numbers to view.
Line numbers are 1-indexed, and -1 for the end line means read to the end of the file. This parameter
can only be used when reading files, not when listing directories.
`;

const viewDescription = `
Read the contents of a file or list a directory. Be sure to use this tool when you're editing a file
and aren't sure what its contents are.

The file contents are returned as a string with 1-indexed line numbers.
`;

export const viewParameters = z.object({
  path: z.string().describe('The absolute path to the file to read.'),
  view_range: z.array(z.number()).optional().describe(viewRangeDescription),
});

export const viewTool: Tool = {
  description: viewDescription,
  inputSchema: viewParameters,
};
