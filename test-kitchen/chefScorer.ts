import * as braintrust from 'braintrust';
import { ChefResult } from './types.js';

export async function chefScorer(props: braintrust.EvalScorerArgs<string, ChefResult, void>) {
  return [
    {
      name: '1/Deploys',
      score: 1 / Math.max(1, props.output.numDeploys),
    },
    {
      name: '1/PromptTokens',
      score: 1 / Math.max(1, props.output.usage.promptTokens),
    },
    {
      name: '1/CompletionTokens',
      score: 1 / Math.max(1, props.output.usage.completionTokens),
    },
  ];
}
