import type { AbsolutePath, RelativePath } from './utils/workDir.js';

export type ConvexProject = {
  token: string;
  deploymentName: string;
  deploymentUrl: string;
  projectSlug: string;
  teamSlug: string;
};

export interface SystemPromptOptions {
  enableBulkEdits: boolean;
  enablePreciseEdits: boolean;
  includeTemplate: boolean;
  openaiProxyEnabled: boolean;
  usingOpenAi: boolean;
  usingGoogle: boolean;
  resendProxyEnabled: boolean;
}

export interface BoltArtifactData {
  id: string;
  title: string;
  type?: string | undefined;
}

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

export interface EditorDocument {
  value: string;
  isBinary: boolean;
  filePath: AbsolutePath;
  scroll?: ScrollPosition;
}

export interface ScrollPosition {
  top: number;
  left: number;
}

export interface File {
  type: 'file';
  content: string;
  isBinary: boolean;
}

export interface Folder {
  type: 'folder';
}

export type Dirent = File | Folder;

export type FileMap = Record<AbsolutePath, Dirent | undefined>;
