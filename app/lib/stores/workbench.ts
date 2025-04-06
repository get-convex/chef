import { atom, map, type ReadableAtom, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import { ActionRunner } from '~/lib/runtime/action-runner';
import type { ActionCallbackData, ArtifactCallbackData } from '~/lib/runtime/message-parser';
import { webcontainer } from '~/lib/webcontainer';
import type { ITerminal } from '~/types/terminal';
import { unreachable } from '~/utils/unreachable';
import { EditorStore } from './editor';
import { FilesStore, type FileMap } from './files';
import { PreviewsStore } from './previews';
import { TerminalStore } from './terminal';
import JSZip from 'jszip';
import fileSaver from 'file-saver';
import { Octokit, type RestEndpointMethodTypes } from '@octokit/rest';
import { path } from '~/utils/path';
import { extractRelativePath } from '~/utils/diff';
import { chatIdStore, description } from '~/lib/persistence';
import Cookies from 'js-cookie';
import { createSampler } from '~/utils/sampler';
import type { ActionAlert } from '~/types/actions';
import type { WebContainer } from '@webcontainer/api';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { buildSnapshot, compressSnapshot } from '~/lib/snapshot';
import { sessionIdStore } from './convex';
import { withResolvers } from '~/utils/promises';
import type { Artifacts, PartId } from './Artifacts';

const BACKUP_DEBOUNCE_MS = 1000 * 5;

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

export class WorkbenchStore {
  #previewsStore = new PreviewsStore(webcontainer);
  #filesStore = new FilesStore(webcontainer);
  #editorStore = new EditorStore(this.#filesStore);
  #terminalStore = new TerminalStore(webcontainer);
  #convexClient: ConvexHttpClient;
  #toolCalls: Map<string, PromiseWithResolvers<string>> = new Map();

  #reloadedParts = new Set<string>();

  artifacts: Artifacts = import.meta.hot?.data.artifacts ?? map({});

  _lastChangedFile: number = 0;

  showWorkbench: WritableAtom<boolean> = import.meta.hot?.data.showWorkbench ?? atom(false);
  currentView: WritableAtom<WorkbenchViewType> = import.meta.hot?.data.currentView ?? atom('code');
  unsavedFiles: WritableAtom<Set<string>> = import.meta.hot?.data.unsavedFiles ?? atom(new Set<string>());
  actionAlert: WritableAtom<ActionAlert | undefined> =
    import.meta.hot?.data.unsavedFiles ?? atom<ActionAlert | undefined>(undefined);
  modifiedFiles = new Set<string>();
  partIdList: PartId[] = [];
  #globalExecutionQueue = Promise.resolve();
  #initialSnapshotLoaded = false;
  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.artifacts = this.artifacts;
      import.meta.hot.data.unsavedFiles = this.unsavedFiles;
      import.meta.hot.data.showWorkbench = this.showWorkbench;
      import.meta.hot.data.currentView = this.currentView;
      import.meta.hot.data.actionAlert = this.actionAlert;
    }

    this.#convexClient = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL!);
    this.startBackup();
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

  async snapshotUrl(id?: string) {
    const SNAPSHOT_URL = 'https://static.convex.dev/flow/snapshot.bin';
    if (!id) {
      console.log('No chat id yet, downloading from Convex');
      return SNAPSHOT_URL;
    }
    const sessionId = sessionIdStore.get();
    if (!sessionId) {
      throw new Error('No session ID found');
    }
    const maybeSnapshotUrl = await this.#convexClient.query(api.snapshot.getSnapshotUrl, { chatId: id, sessionId });
    if (!maybeSnapshotUrl) {
      console.log('No snapshot URL found, downloading from Convex');
      return SNAPSHOT_URL;
    }
    console.log('Snapshot URL found, downloading from Convex');
    return maybeSnapshotUrl;
  }

  async downloadSnapshot(id?: string) {
    const snapshotUrl = await this.snapshotUrl(id);
    // Download the snapshot from Convex
    const resp = await fetch(snapshotUrl);
    if (!resp.ok) {
      throw new Error(`Failed to download snapshot (${resp.statusText}): ${resp.statusText}`);
    }
    return await resp.arrayBuffer();
  }

  async startBackup() {
    let isUploading = false;
    let pendingUpload = false;

    const handleUploadSnapshot = async () => {
      if (isUploading) {
        pendingUpload = true;
        return;
      }

      // Don't upload if initial snapshot hasn't been loaded yet
      if (!this.#initialSnapshotLoaded) {
        console.log('[WorkbenchStore] Skipping upload - initial snapshot not loaded yet');
        return;
      }

      console.log('[WorkbenchStore] Starting upload - initial snapshot loaded');

      try {
        isUploading = true;

        const id = chatIdStore.get();

        if (!id) {
          // Subscribe to chat ID changes and execute upload when it becomes available
          chatIdStore.subscribe((newId) => {
            if (newId) {
              void handleUploadSnapshot();
            }
          });
          return;
        }

        const sessionId = sessionIdStore.get();

        if (!sessionId) {
          throw new Error('Session ID is not set');
        }

        const binarySnapshot = await buildSnapshot('binary', true);

        if (!(binarySnapshot instanceof Uint8Array)) {
          throw new Error('Snapshot must be a Uint8Array');
        }

        const compressed = await compressSnapshot(binarySnapshot);
        const uploadUrl = await this.#convexClient.mutation(api.snapshot.generateUploadUrl);
        const result = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: compressed,
        });

        const response = (await result.json()) as { storageId: string };

        if (!response || typeof response.storageId !== 'string') {
          throw new Error('Invalid response from server');
        }

        await this.#convexClient.mutation(api.snapshot.saveSnapshot, {
          storageId: response.storageId as Id<'_storage'>,
          chatId: id,
          sessionId,
        });
      } catch (error) {
        console.error('Failed to upload snapshot:', error);
      } finally {
        isUploading = false;

        if (pendingUpload) {
          pendingUpload = false;

          // If there was a pending upload while we were uploading, do another upload
          void handleUploadSnapshot();
        }
      }
    };

    let debounceTimeout: NodeJS.Timeout | undefined;
    const debouncedUploadSnapshot = () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      debounceTimeout = setTimeout(handleUploadSnapshot, BACKUP_DEBOUNCE_MS);
    };

    const wc = await webcontainer;

    // Subscribe to file change events
    void (async () => {
      wc.fs.watch(
        '',
        {
          encoding: 'utf-8',
          recursive: true,
          persistent: true,
        },
        () => {
          debouncedUploadSnapshot();
        },
      );
    })();

    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }

  // Add a method to mark initial snapshot as loaded
  markInitialSnapshotLoaded() {
    console.log('[WorkbenchStore] Marking initial snapshot as loaded');
    this.#initialSnapshotLoaded = true;
    console.log('[WorkbenchStore] Initial snapshot loaded state:', this.#initialSnapshotLoaded);
  }

  markInitialSnapshotNotLoaded() {
    console.log('[WorkbenchStore] Marking initial snapshot as not loaded');
    this.#initialSnapshotLoaded = false;
    console.log('[WorkbenchStore] Initial snapshot loaded state:', this.#initialSnapshotLoaded);
  }

  addToExecutionQueue(callback: () => Promise<void>) {
    this.#globalExecutionQueue = this.#globalExecutionQueue.then(() => callback());
  }

  get previews() {
    return this.#previewsStore.previews;
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
      resolvers = withResolvers<string>();
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

  onTerminalResize(cols: number, rows: number) {
    this.#terminalStore.onTerminalResize(cols, rows);
  }

  setDocuments(files: FileMap) {
    this.#editorStore.setDocuments(files);

    if (this.#filesStore.filesCount > 0 && this.currentDocument.get() === undefined) {
      // we find the first file and select it
      for (const [filePath, dirent] of Object.entries(files)) {
        if (dirent?.type === 'file') {
          this.setSelectedFile(filePath);
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

  setSelectedFile(filePath: string | undefined) {
    this.setLastChangedFile();
    this.#editorStore.setSelectedFile(filePath);
  }

  async saveFile(filePath: string) {
    const documents = this.#editorStore.documents.get();
    const document = documents[filePath];

    if (document === undefined) {
      return;
    }

    await this.#filesStore.saveFile(filePath, document.value);

    const newUnsavedFiles = new Set(this.unsavedFiles.get());
    newUnsavedFiles.delete(filePath);

    this.unsavedFiles.set(newUnsavedFiles);
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
    // TODO: what do we wanna do and how do we wanna recover from this?
  }

  setReloadedParts(partIds: PartId[]) {
    this.#reloadedParts = new Set(partIds);
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
          this.setSelectedFile(fullPath);
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

  async downloadZip() {
    const zip = new JSZip();
    const files = this.files.get();

    // Get the project name from the description input, or use a default name
    const projectName = (description.value ?? 'project').toLocaleLowerCase().split(' ').join('_');

    // Generate a simple 6-character hash based on the current timestamp
    const timestampHash = Date.now().toString(36).slice(-6);
    const uniqueProjectName = `${projectName}_${timestampHash}`;

    for (const [filePath, dirent] of Object.entries(files)) {
      if (dirent?.type === 'file' && !dirent.isBinary) {
        const relativePath = extractRelativePath(filePath);

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
        }
      }
    }

    // Generate the zip file and save it
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${uniqueProjectName}.zip`);
  }

  async syncFiles(targetHandle: FileSystemDirectoryHandle) {
    const files = this.files.get();
    const syncedFiles = [];

    for (const [filePath, dirent] of Object.entries(files)) {
      if (dirent?.type === 'file' && !dirent.isBinary) {
        const relativePath = extractRelativePath(filePath);
        const pathSegments = relativePath.split('/');
        let currentHandle = targetHandle;

        for (let i = 0; i < pathSegments.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(pathSegments[i], { create: true });
        }

        // create or get the file
        const fileHandle = await currentHandle.getFileHandle(pathSegments[pathSegments.length - 1], {
          create: true,
        });

        // write the file content
        const writable = await fileHandle.createWritable();
        await writable.write(dirent.content);
        await writable.close();

        syncedFiles.push(relativePath);
      }
    }

    return syncedFiles;
  }

  async pushToGitHub(repoName: string, commitMessage?: string, githubUsername?: string, ghToken?: string) {
    try {
      // Use cookies if username and token are not provided
      const githubToken = ghToken || Cookies.get('githubToken');
      const owner = githubUsername || Cookies.get('githubUsername');

      if (!githubToken || !owner) {
        throw new Error('GitHub token or username is not set in cookies or provided.');
      }

      // Initialize Octokit with the auth token
      const octokit = new Octokit({ auth: githubToken });

      // Check if the repository already exists before creating it
      let repo: RestEndpointMethodTypes['repos']['get']['response']['data'];

      try {
        const resp = await octokit.repos.get({ owner, repo: repoName });
        repo = resp.data;
      } catch (error) {
        if (error instanceof Error && 'status' in error && error.status === 404) {
          // Repository doesn't exist, so create a new one
          const { data: newRepo } = await octokit.repos.createForAuthenticatedUser({
            name: repoName,
            private: false,
            auto_init: true,
          });
          repo = newRepo;
        } else {
          console.log('cannot create repo!');
          throw error; // Some other error occurred
        }
      }

      // Get all files
      const files = this.files.get();

      if (!files || Object.keys(files).length === 0) {
        throw new Error('No files found to push');
      }

      // Create blobs for each file
      const blobs = await Promise.all(
        Object.entries(files).map(async ([filePath, dirent]) => {
          if (dirent?.type === 'file' && dirent.content) {
            const { data: blob } = await octokit.git.createBlob({
              owner: repo.owner.login,
              repo: repo.name,
              content: Buffer.from(dirent.content).toString('base64'),
              encoding: 'base64',
            });
            return { path: extractRelativePath(filePath), sha: blob.sha };
          }

          return null;
        }),
      );

      const validBlobs = blobs.filter(Boolean); // Filter out any undefined blobs

      if (validBlobs.length === 0) {
        throw new Error('No valid files to push');
      }

      // Get the latest commit SHA (assuming main branch, update dynamically if needed)
      const { data: ref } = await octokit.git.getRef({
        owner: repo.owner.login,
        repo: repo.name,
        ref: `heads/${repo.default_branch || 'main'}`, // Handle dynamic branch
      });
      const latestCommitSha = ref.object.sha;

      // Create a new tree
      const { data: newTree } = await octokit.git.createTree({
        owner: repo.owner.login,
        repo: repo.name,
        base_tree: latestCommitSha,
        tree: validBlobs.map((blob) => ({
          path: blob!.path,
          mode: '100644',
          type: 'blob',
          sha: blob!.sha,
        })),
      });

      // Create a new commit
      const { data: newCommit } = await octokit.git.createCommit({
        owner: repo.owner.login,
        repo: repo.name,
        message: commitMessage || 'Initial commit from your app',
        tree: newTree.sha,
        parents: [latestCommitSha],
      });

      // Update the reference
      await octokit.git.updateRef({
        owner: repo.owner.login,
        repo: repo.name,
        ref: `heads/${repo.default_branch || 'main'}`, // Handle dynamic branch
        sha: newCommit.sha,
      });

      alert(`Repository created and code pushed: ${repo.html_url}`);
    } catch (error) {
      console.error('Error pushing to GitHub:', error);
      throw error; // Rethrow the error for further handling
    }
  }
}

export const workbenchStore = new WorkbenchStore();
