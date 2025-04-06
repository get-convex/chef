import type { Change } from 'diff';

export type ActionType = 'file' | 'shell' | 'convex';

interface BaseAction {
  content: string;
}

export interface FileAction extends BaseAction {
  type: 'file';
  filePath: string;
  isEdit?: boolean;
}

export interface ShellAction extends BaseAction {
  type: 'shell';
}

interface NpmInstallAction extends BaseAction {
  type: 'npmInstall';
}

interface NpmExecAction extends BaseAction {
  type: 'npmExec';
}

interface StartAction extends BaseAction {
  type: 'start';
}

interface BuildAction extends BaseAction {
  type: 'build';
}

export interface ConvexAction extends BaseAction {
  type: 'convex';
  output?: string;
}

interface ToolUseAction extends BaseAction {
  type: 'toolUse';
  toolName: string;
}

export type BoltAction =
  | FileAction
  | ShellAction
  | StartAction
  | BuildAction
  | ConvexAction
  | ToolUseAction
  | NpmInstallAction
  | NpmExecAction;

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
