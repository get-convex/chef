import { LanguageModelUsage, LanguageModelV1 } from 'ai';

export type ChefModel = {
  name: string;
  model_slug: string;
  ai: LanguageModelV1;
  maxOutputTokens: number;
};

export type ChefResult = {
  success: boolean;
  numDeploys: number;
  usage: LanguageModelUsage;
  files: Record<string, string>;
};
