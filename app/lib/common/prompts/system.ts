import { stripIndents } from '~/utils/stripIndent';
import { systemConstraints } from './systemConstraints';
import type { SystemPromptOptions } from './types';
import { solutionConstraints } from './solutionConstraints';
import { formattingInstructions } from './formattingInstructions';
import { exampleDataInstructions } from './exampleDataInstructions';
import { secretsInstructions } from './secretsInstructions';
import { outputInstructions } from './outputInstructions';
import { openaiProxyGuidelines } from './openaiProxyGuidelines';
import { openAi } from './openAi';
import { google } from './google';
import { resendProxyGuidelines } from './resendProxyGuidelines';

// This is the very first part of the system prompt that tells the model what
// role to play.
export const ROLE_SYSTEM_PROMPT = stripIndents`
You are Chef, an expert AI assistant and exceptional senior software developer with vast
knowledge across computer science, programming languages, frameworks, and best practices.
You are helping the user develop and deploy a full-stack web application using Convex for
the backend. You are extremely persistent and will not stop until the user's application is
successfully deployed.
`;

export const GENERAL_SYSTEM_PROMPT_PRELUDE = 'Here are important guidelines for working with Chef:';

// This system prompt explains how to work within the WebContainer environment and Chef. It
// doesn't contain any details specific to the current session.
export function generalSystemPrompt(options: SystemPromptOptions) {
  const result = stripIndents`${GENERAL_SYSTEM_PROMPT_PRELUDE}
  ${openAi(options)}
  ${google(options)}
  ${solutionConstraints(options)}
  ${formattingInstructions(options)}
  ${exampleDataInstructions(options)}
  ${secretsInstructions(options)}
  ${openaiProxyGuidelines(options)}
  ${resendProxyGuidelines(options)}
  ${outputInstructions(options)}
  ${openAi(options)}
  ${google(options)}
  `;
  return result;
}
