export type AgentMode = 'bulk' | 'precise';

export interface SystemPromptOptions {
  enableBulkEdits: boolean;
  enablePreciseEdits: boolean;
  includeTemplate: boolean;
}
