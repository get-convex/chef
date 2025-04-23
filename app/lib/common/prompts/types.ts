export interface SystemPromptOptions {
  enableBulkEdits: boolean;
  enablePreciseEdits: boolean;
  includeTemplate: boolean;
  openaiProxyEnabled: boolean;
  usingOpenAi: boolean;
  usingGoogle: boolean;
  resendProxyEnabled: boolean;
  toolsDisabledFromRepeatedErrors: boolean;
  skipSystemPrompt: boolean;
}
