import * as braintrust from 'braintrust';
import { SUGGESTIONS } from 'chef-agent/constants.js';
import { mkdtempSync } from 'fs';
import path from 'path';
import os from 'os';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';
import { chefTask } from './chefTask.js';
import { chefScorer } from './chefScorer.js';
import type { ChefModel } from './types.js';
import * as net from 'net';

const CHEF_PROJECT = 'chef';

function chefEval(model: ChefModel) {
  const experimentName = `${CHEF_PROJECT}-${model.name}`;
  let outputDir = process.env.OUTPUT_TEMPDIR;
  if (!outputDir) {
    outputDir = mkdtempSync(path.join(os.tmpdir(), 'chef-eval'));
  }
  const environment = process.env.ENVIRONMENT ?? 'dev';
  return braintrust.Eval(CHEF_PROJECT, {
    experimentName,
    data: SUGGESTIONS.map((s) => ({ input: s.prompt })),
    task: (input) => chefTask(model, outputDir, input),
    scores: [chefScorer],
    maxConcurrency: 2,
    metadata: {
      model: model.name,
      model_slug: model.model_slug,
      environment,
      tempdir: outputDir,
    },
  });
}

// This is tricky: Node v17 and higher resolve `localhost` IPv6 (::1), which can fail
// if the server only binds to IPv4. Use `setDefaultAutoSelectFamily(true)` to tell
// Node to use Happy Eyeballs to detect IPv6 support.
// Source: https://github.com/nuxt/nuxt/issues/12358
net.setDefaultAutoSelectFamily(true);

if (process.env.ANTHROPIC_API_KEY) {
  chefEval({
    name: 'claude-4-sonnet',
    model_slug: 'claude-sonnet-4-20250514',
    ai: anthropic('claude-sonnet-4-20250514'),
    maxTokens: 16384,
  });
  chefEval({
    name: 'claude-4.5-sonnet',
    model_slug: 'claude-sonnet-4-5',
    ai: anthropic('claude-sonnet-4-5'),
    maxTokens: 16384,
  });
}

// Braintrust sets the OPENAI_API_KEY environment variable even if we don't set it, so we need
// to manually check the USE_OPENAI environment variable to determine if we should use OpenAI.
if (process.env.OPENAI_API_KEY && process.env.USE_OPENAI === 'true') {
  chefEval({
    name: 'gpt-4.1',
    model_slug: 'gpt-4.1',
    ai: openai('gpt-4.1'),
    maxTokens: 8192,
  });
  chefEval({
    name: 'gpt-5',
    model_slug: 'gpt-5',
    ai: openai('gpt-5'),
    maxTokens: 8192,
  });
}

if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  chefEval({
    name: 'gemini-2.5-pro',
    model_slug: 'gemini-2.5-pro',
    ai: google('gemini-2.5-pro'),
    maxTokens: 20000,
  });
}

if (process.env.XAI_API_KEY) {
  chefEval({
    name: 'grok-3-mini',
    model_slug: 'grok-3-mini',
    ai: xai('grok-3-mini'),
    maxTokens: 8192,
  });
}
