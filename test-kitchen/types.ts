import { LanguageModelUsage, LanguageModelV1 } from 'ai';

export type ChefModel = {
  name: string;
  model_slug: string;
  ai: LanguageModelV1;
};

export type ChefResult = {
  numDeploys: number;
  usage: LanguageModelUsage;
  files: Record<string, string>;
};
