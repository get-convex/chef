import { atom, map, type ReadableAtom, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from 'chef-agent/types';
import { ActionRunner } from '~/lib/runtime/action-runner';
import type { ActionCallbackData, ArtifactCallbackData } from 'chef-agent/message-parser';
import { webcontainer } from '~/lib/webcontainer';
import type { ITerminal, TerminalInitializationOptions } from '~/types/terminal';
import { unreachable } from 'chef-agent/utils/unreachable';
import { EditorStore } from './editor';
import { FilesStore } from './files';
import type { FileMap } from 'chef-agent/types';
import type { AbsolutePath } from 'chef-agent/utils/workDir';
import { getAbsolutePath, getRelativePath } from 'chef-agent/utils/workDir';
import { PreviewsStore } from './previews';
import { TerminalStore } from './terminal';
import JSZip from 'jszip';
import fileSaver from 'file-saver';
import { path } from 'chef-agent/utils/path';
import { description } from './description';
import { createSampler } from '~/utils/sampler';
import type { ActionAlert } from '~/types/actions';
import type { WebContainer } from '@webcontainer/api';
import { withResolvers } from '~/utils/promises';
import type { Artifacts } from './artifacts';
import { WORK_DIR } from 'chef-agent/constants';
import { parsePartId, type PartId, type MessageId } from 'chef-agent/partId.js';
import { generateReadmeContent } from '~/lib/download/readmeContent';
import { setupMjsContent } from '~/lib/download/setupMjsContent';
import type { ConvexProject } from 'chef-agent/types';
import { cursorRulesContent } from '~/lib/download/cursorRulesContent';

const { saveAs } = fileSaver;

export interface ArtifactState {
  id: string;
  title: string;
  type?: string;
  closed: boolean;
  runner: ActionRunner;
}

type ArtifactUpdateState = Pick<ArtifactState, 'title' | 'closed'>;

export type WorkbenchViewType = 'code' | 'diff' | 'preview' | 'dashboard';
const MAX_CONSECUTIVE_TOOL_ERRORS = 5;

export class WorkbenchStore {
  #previewsStore = new PreviewsStore(webcontainer);
  #filesStore = new FilesStore(webcontainer);
  #editorStore = new EditorStore(this.#filesStore);
  #terminalStore = new TerminalStore(webcontainer);
  #toolCalls: Map<
    string,
    PromiseWithResolvers<{ result: string; shouldDisableTools: boolean; skipSystemPrompt: boolean }> & { done: boolean }
  > = new Map();

  #reloadedParts = import.meta.hot?.data.reloadedParts ?? new Set<string>();

  artifacts: Artifacts = import.meta.hot?.data.artifacts ?? map({});

  _lastChangedFile: number = 0;

  showWorkbench: WritableAtom<boolean> = import.meta.hot?.data.showWorkbench ?? atom(false);
  currentView: WritableAtom<WorkbenchViewType> = import.meta.hot?.data.currentView ?? atom('code');
  unsavedFiles: WritableAtom<Set<AbsolutePath>> = import.meta.hot?.data.unsavedFiles ?? atom(new Set<AbsolutePath>());
  actionAlert: WritableAtom<ActionAlert | undefined> =
    import.meta.hot?.data.unsavedFiles ?? atom<ActionAlert | undefined>(undefined);
  modifiedFiles = new Set<string>();
  partIdList: PartId[] = [];
  #globalExecutionQueue = Promise.resolve();
  _toolCallResults: Map<MessageId, Array<{ partId: PartId; kind: 'success' | 'error' }>> = new Map();

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.artifacts = this.artifacts;
      import.meta.hot.data.unsavedFiles = this.unsavedFiles;
      import.meta.hot.data.showWorkbench = this.showWorkbench;
      import.meta.hot.data.currentView = this.currentView;
      import.meta.hot.data.actionAlert = this.actionAlert;
      import.meta.hot.data.reloadedParts = this.#reloadedParts;
    }
  }

  get followingStreamedCode() {
    return this.#editorStore.followingStreamedCode;
  }
  resumeFollowingStreamedCode() {
    this.#editorStore.followingStreamedCode.set(true);
  }
  stopFollowingStreamedCode() {
    const following = this.#editorStore.followingStreamedCode.get();
    if (following) {
      this.#editorStore.followingStreamedCode.set(false);
    }
  }

  get justChangedFiles(): boolean {
    const now = Date.now();
    const close = 300;
    return now - this._lastChangedFile < close;
  }
  setLastChangedFile(): void {
    this._lastChangedFile = Date.now();
  }

  addToExecutionQueue(callback: () => Promise<void>) {
    this.#globalExecutionQueue = this.#globalExecutionQueue.then(() => callback());
  }

  get previews() {
    return this.#previewsStore.previews;
  }

  async startProxy(sourcePort: number) {
    return this.#previewsStore.startProxy(sourcePort);
  }

  stopProxy(proxyPort: number) {
    return this.#previewsStore.stopProxy(proxyPort);
  }

  get files() {
    return this.#filesStore.files;
  }

  get userWrites() {
    return this.#filesStore.userWrites;
  }

  prewarmWorkdir(container: WebContainer) {
    return this.#filesStore.prewarmWorkdir(container);
  }

  async waitOnToolCall(
    toolCallId: string,
  ): Promise<{ result: string; shouldDisableTools: boolean; skipSystemPrompt: boolean }> {
    let resolvers = this.#toolCalls.get(toolCallId);
    if (!resolvers) {
      resolvers = {
        ...withResolvers<{ result: string; shouldDisableTools: boolean; skipSystemPrompt: boolean }>(),
        done: false,
      };
      this.#toolCalls.set(toolCallId, resolvers);
    }
    return await resolvers.promise;
  }

  get currentDocument(): ReadableAtom<EditorDocument | undefined> {
    return this.#editorStore.currentDocument;
  }

  get selectedFile(): ReadableAtom<string | undefined> {
    return this.#editorStore.selectedFile;
  }

  get firstArtifact(): ArtifactState | undefined {
    return this.#getArtifact(this.partIdList[0]);
  }

  get filesCount(): number {
    return this.#filesStore.filesCount;
  }

  get showTerminal() {
    return this.#terminalStore.showTerminal;
  }
  get boltTerminal() {
    return this.#terminalStore.boltTerminal;
  }

  get alert() {
    return this.actionAlert;
  }
  clearAlert() {
    this.actionAlert.set(undefined);
  }

  toggleTerminal(value?: boolean) {
    this.#terminalStore.toggleTerminal(value);
  }

  attachTerminal(terminal: ITerminal) {
    this.#terminalStore.attachTerminal(terminal);
  }
  attachBoltTerminal(terminal: ITerminal) {
    this.#terminalStore.attachBoltTerminal(terminal);
  }
  attachDeployTerminal(terminal: ITerminal, options?: TerminalInitializationOptions) {
    this.#terminalStore.attachDeployTerminal(terminal, options);
  }

  onTerminalResize(cols: number, rows: number) {
    this.#terminalStore.onTerminalResize(cols, rows);
  }

  setDocuments(files: FileMap) {
    this.#editorStore.setDocuments(files);

    if (this.#filesStore.filesCount > 0 && this.currentDocument.get() === undefined) {
      // we find the first file and select it
      for (const [filePath, dirent] of Object.entries(files)) {
        if (dirent?.type === 'file') {
          // Note -- cast is safe since `FileMap` is a record of `AbsolutePath` -> `Dirent`,
          // but `Object.entries` loses the type information.
          this.setSelectedFile(filePath as AbsolutePath);
          break;
        }
      }
    }
  }

  setShowWorkbench(show: boolean) {
    this.showWorkbench.set(show);
  }

  setCurrentDocumentContent(newContent: string) {
    const filePath = this.currentDocument.get()?.filePath;

    if (!filePath) {
      return;
    }

    const originalContent = this.#filesStore.getFile(filePath)?.content;
    const unsavedChanges = originalContent !== undefined && originalContent !== newContent;

    this.#editorStore.updateFile(filePath, newContent);

    const currentDocument = this.currentDocument.get();

    if (currentDocument) {
      const previousUnsavedFiles = this.unsavedFiles.get();

      if (unsavedChanges && previousUnsavedFiles.has(currentDocument.filePath)) {
        return;
      }

      const newUnsavedFiles = new Set(previousUnsavedFiles);

      if (unsavedChanges) {
        newUnsavedFiles.add(currentDocument.filePath);
      } else {
        newUnsavedFiles.delete(currentDocument.filePath);
      }

      this.unsavedFiles.set(newUnsavedFiles);
    }
  }

  setCurrentDocumentScrollPosition(position: ScrollPosition) {
    const editorDocument = this.currentDocument.get();

    if (!editorDocument) {
      return;
    }

    const { filePath } = editorDocument;

    this.#editorStore.updateScrollPosition(filePath, position);
  }

  setSelectedFile(filePath: AbsolutePath | undefined) {
    this.setLastChangedFile();
    this.#editorStore.setSelectedFile(filePath);
  }

  async saveFile(filePath: string) {
    const documents = this.#editorStore.documents.get();
    const absPath = getAbsolutePath(filePath);
    const document = documents[absPath];

    if (document === undefined) {
      return;
    }

    await this.#filesStore.saveFile(absPath, document.value);

    const newUnsavedFiles = new Set(this.unsavedFiles.get());
    newUnsavedFiles.delete(absPath);

    this.unsavedFiles.set(newUnsavedFiles);
    // If the file is in the convex/ folder, rerun convex deploy
    if (filePath.startsWith(path.join(WORK_DIR, 'convex'))) {
      await this.#terminalStore.deployFunctionsAndRunDevServer(true);
    }
  }

  async saveCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    await this.saveFile(currentDocument.filePath);
  }

  resetCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    const { filePath } = currentDocument;
    const file = this.#filesStore.getFile(filePath);

    if (!file) {
      return;
    }

    this.setCurrentDocumentContent(file.content);
  }

  async saveAllFiles() {
    for (const filePath of this.unsavedFiles.get()) {
      await this.saveFile(filePath);
    }
  }

  getFileModifcations() {
    return this.#filesStore.getFileModifications();
  }
  getModifiedFiles() {
    return this.#filesStore.getModifiedFiles();
  }

  resetAllFileModifications() {
    this.#filesStore.resetFileModifications();
  }

  abortAllActions() {
    // Update all running tools to aborted status
    const artifacts = this.artifacts.get();
    Object.values(artifacts).forEach((artifact) => {
      const actions = artifact.runner.actions.get();
      Object.entries(actions).forEach(([actionId, action]) => {
        if (action.status === 'running' || action.status === 'pending') {
          artifact.runner.updateAction(actionId, {
            ...action,
            status: 'aborted',
          });
        }
      });
    });
  }

  addReloadedPart(partId: PartId) {
    this.#reloadedParts.add(partId);
  }

  isReloadedPart(partId: PartId) {
    return this.#reloadedParts.has(partId);
  }

  addArtifact({ partId, title, id, type }: ArtifactCallbackData) {
    const messageId = parsePartId(partId).messageId;
    if (!this._toolCallResults.has(messageId)) {
      this._toolCallResults.set(messageId, []);
    }
    const artifact = this.#getArtifact(partId);

    if (artifact) {
      return;
    }

    if (!this.partIdList.includes(partId)) {
      this.partIdList.push(partId);
    }

    this.artifacts.setKey(partId, {
      id,
      title,
      closed: false,
      type,
      runner: new ActionRunner(webcontainer, this.boltTerminal, {
        onAlert: (alert) => {
          if (this.#reloadedParts.has(partId)) {
            return;
          }

          this.actionAlert.set(alert);
        },
        onToolCallComplete: ({ kind, result, toolCallId, toolName }) => {
          const toolCallPromise = this.#toolCalls.get(toolCallId);
          if (!toolCallPromise) {
            console.error('Tool call promise not found');
            return;
          }
          const messageId = parsePartId(partId).messageId;
          const toolCallResults = this._toolCallResults.get(messageId);
          if (!toolCallResults) {
            console.error('Tool call results not found');
            toolCallPromise.resolve({ result, shouldDisableTools: false, skipSystemPrompt: false });
            return;
          }
          toolCallResults.push({ partId, kind });

          if (kind === 'success') {
            toolCallPromise.resolve({
              result,
              shouldDisableTools: false,
              // Skip sending the system prompt if the last tool call was a successful deploy. The model should not need any Convex information at that point.
              skipSystemPrompt: toolName === 'deploy',
            });
            return;
          }
          if (kind === 'error') {
            let numConsecutiveErrors = 0;
            for (let i = toolCallResults.length - 1; i >= 0; i--) {
              if (toolCallResults[i].kind === 'error') {
                numConsecutiveErrors++;
              } else {
                break;
              }
            }
            toolCallPromise.resolve({
              result,
              shouldDisableTools: numConsecutiveErrors >= MAX_CONSECUTIVE_TOOL_ERRORS,
              skipSystemPrompt: false,
            });
          }
        },
      }),
    });
  }

  updateArtifact({ partId }: ArtifactCallbackData, state: Partial<ArtifactUpdateState>) {
    const artifact = this.#getArtifact(partId);

    if (!artifact) {
      return;
    }

    this.artifacts.setKey(partId, { ...artifact, ...state });
  }
  addAction(data: ActionCallbackData) {
    this.addToExecutionQueue(() => this._addAction(data));
  }
  async _addAction(data: ActionCallbackData) {
    const { partId } = data;

    const artifact = this.#getArtifact(partId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    return artifact.runner.addAction(data);
  }

  runAction(data: ActionCallbackData, isStreaming: boolean = false) {
    if (isStreaming) {
      this.actionStreamSampler(data, isStreaming);
    } else {
      this.addToExecutionQueue(() => this._runAction(data, isStreaming));
    }
  }
  async _runAction(data: ActionCallbackData, isStreaming: boolean = false) {
    const { partId } = data;

    const artifact = this.#getArtifact(partId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    const action = artifact.runner.actions.get()[data.actionId];

    // Skip running actions if they are part of a reloaded message
    if (this.isReloadedPart(partId)) {
      artifact.runner.updateAction(data.actionId, { executed: true, status: 'complete' });
      return;
    }

    if (!action || action.executed) {
      return;
    }

    if (data.action.type === 'file') {
      const wc = await webcontainer;
      const fullPath = path.join(wc.workdir, data.action.filePath);

      if (this.selectedFile.value !== fullPath) {
        // Consider focusing the streaming tab so user can see code flowing in.
        const selectedView = workbenchStore.currentView.value;
        const followingStreamedCode = workbenchStore.followingStreamedCode.get();
        if (selectedView === 'code' && followingStreamedCode) {
          this.setSelectedFile(fullPath as AbsolutePath);
        }
      }

      const doc = this.#editorStore.documents.get()[fullPath];

      if (!doc) {
        await artifact.runner.runAction(data, { isStreaming: !!isStreaming });
      }

      // Where does this initial newline come from? The tool parsing incorrectly?
      const newContent = data.action.content.trimStart();

      this.#editorStore.updateFile(fullPath, newContent);

      if (!isStreaming) {
        await artifact.runner.runAction(data, { isStreaming: !!isStreaming });
        this.resetAllFileModifications();
      }
    } else {
      const action = data.action;
      if (action.type === 'toolUse') {
        let toolCallPromise = this.#toolCalls.get(action.parsedContent.toolCallId);
        if (!toolCallPromise) {
          toolCallPromise = {
            ...withResolvers<{ result: string; shouldDisableTools: boolean; skipSystemPrompt: boolean }>(),
            done: false,
          };
          this.#toolCalls.set(action.parsedContent.toolCallId, toolCallPromise);
        }
      }
      await artifact.runner.runAction(data, { isStreaming: !!isStreaming });
    }
  }

  actionStreamSampler = createSampler(async (data: ActionCallbackData, isStreaming: boolean = false) => {
    return await this._runAction(data, isStreaming);
  }, 100); // TODO: remove this magic number to have it configurable

  #getArtifact(partId: PartId): ArtifactState | undefined {
    const artifacts = this.artifacts.get();
    return artifacts[partId];
  }

  async downloadZip(args: { convexProject: ConvexProject | null }) {
    const zip = new JSZip();
    const files = this.files.get();

    // Get the project name from the description input, or use a default name
    const projectName = (description.value ?? 'project').toLocaleLowerCase().split(' ').join('_');

    // Generate a simple 6-character hash based on the current timestamp
    const timestampHash = Date.now().toString(36).slice(-6);
    const uniqueProjectName = `${projectName}_${timestampHash}`;

    let hasReadme = false;
    let hasSetupMjs = false;
    let hasEnvLocalFile = false;
    let hasCursorRules = false;

    for (const [filePath, dirent] of Object.entries(files)) {
      if (dirent?.type === 'file' && !dirent.isBinary) {
        const relativePath = getRelativePath(filePath);

        // split the path into segments
        const pathSegments = relativePath.split('/');

        // if there's more than one segment, we need to create folders
        if (pathSegments.length > 1) {
          let currentFolder = zip;

          for (let i = 0; i < pathSegments.length - 1; i++) {
            currentFolder = currentFolder.folder(pathSegments[i])!;
          }
          currentFolder.file(pathSegments[pathSegments.length - 1], dirent.content);

          if (relativePath === '.cursor/rules/convex_rules.mdc') {
            hasCursorRules = true;
          }
        } else {
          // if there's only one segment, it's a file in the root
          zip.file(relativePath, dirent.content);
          if (relativePath.toLowerCase() === 'readme.md') {
            hasReadme = true;
          }
          if (relativePath.toLowerCase() === 'setup.mjs') {
            hasSetupMjs = true;
          }
          if (relativePath.toLowerCase() === '.env.local') {
            hasEnvLocalFile = true;
          }
        }
      }
    }

    // Add a README.md file specific to Chef here, but don't clobber an existing one
    const readmeContent = generateReadmeContent(
      description.value ?? 'project',
      args.convexProject?.deploymentName ?? null,
    );
    const readmePath = hasReadme ? `CHEF_README_${timestampHash}.md` : 'README.md';
    zip.file(readmePath, readmeContent);
    if (!hasSetupMjs) {
      zip.file('setup.mjs', setupMjsContent);
    }
    if (!hasEnvLocalFile && args.convexProject) {
      const convexDeploymentEnvVar = `dev:${args.convexProject.deploymentName} # team: ${args.convexProject.teamSlug} project: ${args.convexProject.projectSlug}`;
      zip.file('.env.local', `CONVEX_DEPLOYMENT=${convexDeploymentEnvVar}`);
    }
    if (!hasCursorRules) {
      zip.file('.cursor/rules/convex_rules.mdc', cursorRulesContent);
    }
    // Generate the zip file and save it
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${uniqueProjectName}.zip`);
  }

  isDefaultPreviewRunning() {
    const DEFAULT_PREVIEW_PORT = 5173;
    const previews = this.previews.get();
    return previews.some((preview) => preview.port === DEFAULT_PREVIEW_PORT);
  }
}

export const workbenchStore = new WorkbenchStore();
