import { atom, map, type ReadableAtom, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import { ActionRunner } from '~/lib/runtime/action-runner';
import type { ActionCallbackData, ArtifactCallbackData } from '~/lib/runtime/message-parser';
import { webcontainer } from '~/lib/webcontainer';
import type { ITerminal, TerminalInitializationOptions } from '~/types/terminal';
import { unreachable } from '~/utils/unreachable';
import { EditorStore } from './editor';
import {
  FILE_EVENTS_DEBOUNCE_MS,
  FilesStore,
  getAbsolutePath,
  getRelativePath,
  type AbsolutePath,
  type FileMap,
} from './files';
import { PreviewsStore } from './previews';
import { TerminalStore } from './terminal';
import JSZip from 'jszip';
import fileSaver from 'file-saver';
import { path } from '~/utils/path';
import { description } from './description';
import { createSampler } from '~/utils/sampler';
import type { ActionAlert } from '~/types/actions';
import type { WebContainer } from '@webcontainer/api';
import type { Id } from '@convex/_generated/dataModel';
import { buildUncompressedSnapshot, compressSnapshot } from '~/lib/snapshot';
import { waitForConvexSessionId } from './sessionId';
import { withResolvers } from '~/utils/promises';
import type { Artifacts, PartId } from './artifacts';
import { backoffTime, WORK_DIR } from '~/utils/constants';
import { chatIdStore } from '~/lib/stores/chatId';
import { getFileUpdateCounter, waitForFileUpdateCounterChanged } from './fileUpdateCounter';
import { generateReadmeContent } from '~/lib/readmeContent';
import { getConvexSiteUrl } from '~/lib/convexSiteUrl';

const BACKUP_DEBOUNCE_MS = 1000;

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

export type BackupState = {
  started: boolean;
  numFailures: number;
  savedUpdateCounter: number | null;
  lastSync: number;
};

export class WorkbenchStore {
  #previewsStore = new PreviewsStore(webcontainer);
  #filesStore = new FilesStore(webcontainer);
  #editorStore = new EditorStore(this.#filesStore);
  #terminalStore = new TerminalStore(webcontainer);
  #toolCalls: Map<string, PromiseWithResolvers<string> & { done: boolean }> = new Map();

  #reloadedParts = import.meta.hot?.data.reloadedParts ?? new Set<string>();

  artifacts: Artifacts = import.meta.hot?.data.artifacts ?? map({});

  _lastChangedFile: number = 0;

  showWorkbench: WritableAtom<boolean> = import.meta.hot?.data.showWorkbench ?? atom(false);
  currentView: WritableAtom<WorkbenchViewType> = import.meta.hot?.data.currentView ?? atom('code');
  unsavedFiles: WritableAtom<Set<AbsolutePath>> = import.meta.hot?.data.unsavedFiles ?? atom(new Set<AbsolutePath>());
  actionAlert: WritableAtom<ActionAlert | undefined> =
    import.meta.hot?.data.unsavedFiles ?? atom<ActionAlert | undefined>(undefined);
  backupState: WritableAtom<BackupState> =
    import.meta.hot?.data.backupState ??
    atom<BackupState>({
      started: false,
      numFailures: 0,
      savedUpdateCounter: null,
      lastSync: 0,
    });
  modifiedFiles = new Set<string>();
  partIdList: PartId[] = [];
  #globalExecutionQueue = Promise.resolve();

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.artifacts = this.artifacts;
      import.meta.hot.data.unsavedFiles = this.unsavedFiles;
      import.meta.hot.data.showWorkbench = this.showWorkbench;
      import.meta.hot.data.currentView = this.currentView;
      import.meta.hot.data.actionAlert = this.actionAlert;
      import.meta.hot.data.backupState = this.backupState;
      import.meta.hot.data.reloadedParts = this.#reloadedParts;
    }
  }

  get followingStreamedCode() {
    return this.#editorStore.followingStreamedCode;
  }

  get justChangedFiles(): boolean {
    const now = Date.now();
    const close = 300;
    return now - this._lastChangedFile < close;
  }
  setLastChangedFile(): void {
    this._lastChangedFile = Date.now();
  }

  // Start the backup worker, assuming that the current filesystem state is
  // fully saved. Therefore, this method must be called early in initialization
  // after the snapshot has been loaded but before any subsequent changes are
  // made.
  async startBackup() {
    // This is a bit racy, but we need to flush the current file events before
    // deciding that we're synced up to the current update counter. Sleep for
    // twice the batching interval.
    await new Promise((resolve) => setTimeout(resolve, 2 * FILE_EVENTS_DEBOUNCE_MS));

    this.backupState.set({
      started: true,
      numFailures: 0,
      savedUpdateCounter: getFileUpdateCounter(),
      lastSync: 0,
    });

    void backupWorker(this.backupState);

    // Add beforeunload event listener to prevent navigation while uploading
    const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      const currentState = this.backupState.get();
      const currentUpdateCounter = getFileUpdateCounter();
      if (currentState.started && currentState.savedUpdateCounter !== currentUpdateCounter) {
        // Some browsers require both preventDefault and setting returnValue
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
      return undefined;
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);
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
    this.#filesStore.prewarmWorkdir(container);
  }

  async waitOnToolCall(toolCallId: string): Promise<string> {
    let resolvers = this.#toolCalls.get(toolCallId);
    if (!resolvers) {
      resolvers = { ...withResolvers<string>(), done: false };
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
  attachBoltTerminal(terminal: ITerminal, isReload: boolean) {
    this.#terminalStore.attachBoltTerminal(terminal, isReload);
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
      runner: new ActionRunner(
        this.#toolCalls,
        webcontainer,
        () => this.boltTerminal,
        (alert) => {
          if (this.#reloadedParts.has(partId)) {
            return;
          }

          this.actionAlert.set(alert);
        },
      ),
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
    // this._addAction(data);

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
        await artifact.runner.runAction(data, isStreaming);
      }

      // Where does this initial newline come from? The tool parsing incorrectly?
      const newContent = data.action.content.trimStart();

      this.#editorStore.updateFile(fullPath, newContent);

      if (!isStreaming) {
        await artifact.runner.runAction(data);
        this.resetAllFileModifications();
        // hack, sometimes this isn't cleared
        //setTimeout(() => this.resetAllFileModifications(), 10);
      }
    } else {
      await artifact.runner.runAction(data);
    }
  }

  actionStreamSampler = createSampler(async (data: ActionCallbackData, isStreaming: boolean = false) => {
    return await this._runAction(data, isStreaming);
  }, 100); // TODO: remove this magic number to have it configurable

  #getArtifact(partId: PartId): ArtifactState | undefined {
    const artifacts = this.artifacts.get();
    return artifacts[partId];
  }

  async downloadZip(args: { convexDeploymentName: string | null }) {
    const zip = new JSZip();
    const files = this.files.get();

    // Get the project name from the description input, or use a default name
    const projectName = (description.value ?? 'project').toLocaleLowerCase().split(' ').join('_');

    // Generate a simple 6-character hash based on the current timestamp
    const timestampHash = Date.now().toString(36).slice(-6);
    const uniqueProjectName = `${projectName}_${timestampHash}`;

    let hasReadme = false;

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
        } else {
          // if there's only one segment, it's a file in the root
          zip.file(relativePath, dirent.content);
          if (relativePath.toLowerCase() === 'readme.md') {
            hasReadme = true;
          }
        }
      }
    }

    // Add a README.md file specific to Chef here, but don't clobber an existing one
    const readmeContent = generateReadmeContent(description.value ?? 'project', args.convexDeploymentName);
    const readmePath = hasReadme ? `CHEF_README_${timestampHash}.md` : 'README.md';
    zip.file(readmePath, readmeContent);
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

async function backupWorker(backupState: WritableAtom<BackupState>) {
  const sessionId = await waitForConvexSessionId('backupWorker');
  while (true) {
    const currentState = backupState.get();
    if (currentState.savedUpdateCounter !== null) {
      await waitForFileUpdateCounterChanged(currentState.savedUpdateCounter);
    }
    const nextSync = currentState.lastSync + BACKUP_DEBOUNCE_MS;
    const now = Date.now();
    if (now < nextSync) {
      await new Promise((resolve) => setTimeout(resolve, nextSync - now));
    }
    const nextUpdateCounter = getFileUpdateCounter();
    try {
      await performBackup(sessionId);
    } catch (error) {
      console.error('Failed to upload snapshot:', error);
      backupState.set({
        ...currentState,
        numFailures: currentState.numFailures + 1,
      });
      const sleepTime = backoffTime(currentState.numFailures);
      console.error(
        `Failed to upload snapshot (num failures: ${currentState.numFailures}), sleeping for ${sleepTime.toFixed(2)}ms`,
        error,
      );
      await new Promise((resolve) => setTimeout(resolve, sleepTime));
      continue;
    }
    backupState.set({
      ...currentState,
      savedUpdateCounter: nextUpdateCounter,
      lastSync: now,
      numFailures: 0,
    });
  }
}

async function performBackup(sessionId: Id<'sessions'>) {
  const convexSiteUrl = getConvexSiteUrl();
  const chatId = chatIdStore.get();
  const binarySnapshot = await buildUncompressedSnapshot();
  const compressed = await compressSnapshot(binarySnapshot);

  const uploadUrl = `${convexSiteUrl}/upload_snapshot?sessionId=${sessionId}&chatId=${chatId}`;
  const result = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: compressed,
  });
  console.log('Uploaded snapshot', result);
}
