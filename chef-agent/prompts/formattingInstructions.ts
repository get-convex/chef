import type { SystemPromptOptions } from '../types.js';
import { stripIndents } from '../utils/stripIndent.js';

export const allowedHTMLElements = [
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'dd',
  'del',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'ins',
  'kbd',
  'li',
  'ol',
  'p',
  'pre',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'samp',
  'source',
  'span',
  'strike',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
  'var',
  'think',
];

export function formattingInstructions(_options: SystemPromptOptions) {
  return stripIndents`
  <formatting_instructions>
    <code_formatting_instructions>
      Use 2 spaces for code indentation.
    </code_formatting_instructions>
    <message_formatting_instructions>
      You can make text output pretty by using Markdown or the following available HTML elements:
      ${allowedHTMLElements.map((tagName) => `<${tagName}>`).join(', ')}
    </message_formatting_instructions>
  </formatting_instructions>
  `;
}
