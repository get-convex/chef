import { allowedHTMLElements } from '~/utils/markdown';
import type { SystemPromptOptions } from './types';
import { stripIndents } from '~/utils/stripIndent';

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
