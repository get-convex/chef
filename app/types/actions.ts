import type { Change } from 'diff';
import type { RelativePath } from '~/lib/stores/files';
export type ActionType = 'file' | 'toolUse';

interface BaseAction {
  content: string;
}

export interface FileAction extends BaseAction {
  type: 'file';
  filePath: RelativePath;
  isEdit?: boolean;
}

interface ToolUseAction extends BaseAction {
  type: 'toolUse';
  toolName: string;
}

export type BoltAction = FileAction | ToolUseAction;

export type BoltActionData = BoltAction | BaseAction;

export interface ActionAlert {
  type: string;
  title: string;
  description: string;
  content: string;
  source?: 'terminal' | 'preview'; // Add source to differentiate between terminal and preview errors
}

export interface FileHistory {
  originalContent: string;
  lastModified: number;
  changes: Change[];
  versions: {
    timestamp: number;
    content: string;
  }[];

  // Novo campo para rastrear a origem das mudanças
  changeSource?: 'user' | 'auto-save' | 'external';
}
