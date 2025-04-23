import { stripIndents } from '../utils/stripIndent.js';
import { systemConstraints } from './systemConstraints.js';
import type { SystemPromptOptions } from '../types.js';
import { solutionConstraints } from './solutionConstraints.js';
import { formattingInstructions } from './formattingInstructions.js';
import { exampleDataInstructions } from './exampleDataInstructions.js';
import { secretsInstructions } from './secretsInstructions.js';
import { outputInstructions } from './outputInstructions.js';
import { openaiProxyGuidelines } from './openaiProxyGuidelines.js';
import { openAi } from './openAi.js';
import { google } from './google.js';
import { resendProxyGuidelines } from './resendProxyGuidelines.js';

// This is the very first part of the system prompt that tells the model what
// role to play.
export const ROLE_SYSTEM_PROMPT = stripIndents`
You are Chef, an expert AI assistant and exceptional senior software developer with vast
knowledge across computer science, programming languages, frameworks, and best practices.
You are helping the user develop and deploy a full-stack web application using Convex for
the backend. Convex is a reactive database with real-time updates. You are extremely persistent 
and will not stop until the user's application is successfully deployed. You are concise.
`;

export const GENERAL_SYSTEM_PROMPT_PRELUDE = 'Here are important guidelines for working with Chef:';

// This system prompt explains how to work within the WebContainer environment and Chef. It
// doesn't contain any details specific to the current session.
export function generalSystemPrompt(options: SystemPromptOptions) {
  const result = stripIndents`${GENERAL_SYSTEM_PROMPT_PRELUDE}
  ${openAi(options)}
  ${google(options)}
  ${systemConstraints(options)}
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
