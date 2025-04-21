import * as braintrust from 'braintrust';
import { SUGGESTIONS } from 'chef-agent/constants.js';
import { mkdtempSync } from 'fs';
import path from 'path';
import os from 'os';
import { anthropic } from '@ai-sdk/anthropic';
import { chefTask } from './chefTask.js';
import { chefScorer } from './chefScorer.js';
import { ChefModel } from './types.js';
import * as net from 'net';

const CHEF_PROJECT = 'chef';

function chefEval(model: ChefModel) {
  let outputDir = process.env.OUTPUT_TEMPDIR;
  if (!outputDir) {
    outputDir = mkdtempSync(path.join(os.tmpdir(), 'chef-eval'));
  }

  const environment = process.env.ENVIRONMENT ?? 'dev';
  braintrust.Eval(CHEF_PROJECT, {
    data: [
      {
        input: SUGGESTIONS[0].prompt,
      },
    ],
    task: (input) => chefTask(model, outputDir, input),
    scores: [chefScorer],
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

chefEval({
  name: 'claude-3.5-sonnet',
  model_slug: 'claude-3-5-sonnet-20240620',
  ai: anthropic('claude-3-5-sonnet-20241022'),
});
