import * as braintrust from 'braintrust';
import { ChefResult } from './types.js';

export async function chefScorer(props: braintrust.EvalScorerArgs<string, ChefResult, void>) {
  return [
    {
      name: '1/Deploys',
      score: props.output.success ? 1 / Math.max(1, props.output.numDeploys) : 0,
    },
  ];
}
