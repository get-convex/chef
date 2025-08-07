import type { WebContainer, PathWatcherEvent } from '@webcontainer/api';
import { getEncoding } from 'istextorbinary';
import { map, type MapStore } from 'nanostores';
import { Buffer } from 'node:buffer';
import { path } from 'chef-agent/utils/path';
import { bufferWatchEvents } from '~/utils/buffer';
import { WORK_DIR } from 'chef-agent/constants.js';
import { computeFileModifications } from '~/utils/diff';
import { createScopedLogger } from 'chef-agent/utils/logger';
import { unreachable } from 'chef-agent/utils/unreachable';
import { incrementFileUpdateCounter } from './fileUpdateCounter';
import { getAbsolutePath, type AbsolutePath } from 'chef-agent/utils/workDir';
import type { File, FileMap } from 'chef-agent/types';

const logger = createScopedLogger('FilesStore');

const utf8TextDecoder = new TextDecoder('utf8', { fatal: true });

export class FilesStore {
  #webcontainer: Promise<WebContainer>;

  /**
   * Tracks the number of files without folders.
   */
  #size = 0;

  /**
   * @note Keeps track all modified files with their original content since the last user message.
   * Needs to be reset when the user sends another message and all changes have to be submitted
   * for the model to be aware of the changes.
   */
  #modifiedFiles: Map<AbsolutePath, string> = import.meta.hot?.data.modifiedFiles ?? new Map();

  /**
   * Map of files that matches the state of WebContainer.
   */
  files: MapStore<FileMap> = import.meta.hot?.data.files ?? map({});
  userWrites: Map<AbsolutePath, number> = import.meta.hot?.data.userWrites ?? new Map();

  get filesCount() {
    return this.#size;
  }

  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;

    if (import.meta.hot) {
      import.meta.hot.data.files = this.files;
      import.meta.hot.data.modifiedFiles = this.#modifiedFiles;
      import.meta.hot.data.userWrites = this.userWrites;
    }

    this.#init();
  }

  getFile(filePath: AbsolutePath) {
    const dirent = this.files.get()[filePath];

    if (dirent?.type !== 'file') {
      return undefined;
    }

    return dirent;
  }

  getFileModifications() {
    return computeFileModifications(this.files.get(), this.#modifiedFiles);
  }
  getModifiedFiles() {
    let modifiedFiles: { [path: string]: File } | undefined = undefined;

    for (const [filePath, originalContent] of this.#modifiedFiles) {
      const file = this.files.get()[filePath];

      if (file?.type !== 'file') {
        continue;
      }

      if (file.content === originalContent) {
        continue;
      }

      if (!modifiedFiles) {
        modifiedFiles = {};
      }

      modifiedFiles[filePath] = file;
    }

    return modifiedFiles;
  }

  resetFileModifications() {
    this.#modifiedFiles.clear();
  }

  async saveFile(filePath: AbsolutePath, content: string) {
    const webcontainer = await this.#webcontainer;

    try {
      const relativePath = path.relative(webcontainer.workdir, filePath);

      if (!relativePath) {
        throw new Error(`EINVAL: invalid file path, write '${relativePath}'`);
      }

      const oldContent = this.getFile(filePath)?.content;

      if (!oldContent) {
        unreachable('Expected content to be defined');
      }

      await webcontainer.fs.writeFile(relativePath, content);

      if (!this.#modifiedFiles.has(filePath)) {
        this.#modifiedFiles.set(filePath, oldContent);
      }

      // we immediately update the file and don't rely on the `change` event coming from the watcher
      this.files.setKey(filePath, {
        type: 'file',

        file: {
          content,
          isBinary: false
        }
      });
      this.userWrites.set(filePath, Date.now());

      logger.info('File updated');
    } catch (error) {
      logger.error('Failed to update file content\n\n', error);

      throw error;
    }
  }

  async #init() {
    const webcontainer = await this.#webcontainer;
    (globalThis as any).webcontainer = webcontainer;
    webcontainer.internal.watchPaths(
      { include: [`${WORK_DIR}/**`], exclude: ['**/node_modules', '.git'], includeContent: true },
      bufferWatchEvents(FILE_EVENTS_DEBOUNCE_MS, this.#processEventBuffer.bind(this)),
    );
  }

  async prewarmWorkdir(container: WebContainer) {
    const absFilePaths = await container.internal.fileSearch([] as any, WORK_DIR, {
      excludes: ['.gitignore', 'node_modules'],
    });
    const dirs = new Set<string>();
    for (const absPath of absFilePaths) {
      const dir = path.dirname(absPath);
      const relativePath = path.relative(container.workdir, absPath);
      if (!relativePath) {
        continue;
      }
      dirs.add(dir);
    }
    for (const dir of Array.from(dirs).sort()) {
      const sanitizedPath = dir.replace(/\/+$/g, '');
      this.files.setKey(getAbsolutePath(sanitizedPath), { type: 'folder' });
    }

    const loadFile = async (absPath: string) => {
      const relativePath = path.relative(container.workdir, absPath);
      if (!relativePath) {
        return;
      }
      const buffer = await container.fs.readFile(relativePath);
      const isBinary = isBinaryFile(buffer);
      let content = '';
      if (!isBinary) {
        content = this.#decodeFileContent(buffer);
      }
      this.files.setKey(getAbsolutePath(absPath), {
        type: 'file',

        file: {
          content,
          isBinary
        }
      });
    };
    await Promise.all(absFilePaths.map(loadFile));
  }

  #processEventBuffer(events: Array<[events: PathWatcherEvent[]]>) {
    const watchEvents = events.flat(2);

    for (const { type, path, buffer } of watchEvents) {
      // remove any trailing slashes
      const sanitizedPath = path.replace(/\/+$/g, '');
      incrementFileUpdateCounter(sanitizedPath);

      switch (type) {
        case 'add_dir': {
          // we intentionally add a trailing slash so we can distinguish files from folders in the file tree
          this.files.setKey(getAbsolutePath(sanitizedPath), { type: 'folder' });
          break;
        }
        case 'remove_dir': {
          this.files.setKey(getAbsolutePath(sanitizedPath), undefined);

          for (const [direntPath] of Object.entries(this.files)) {
            if (direntPath.startsWith(sanitizedPath)) {
              this.files.setKey(getAbsolutePath(direntPath), undefined);
            }
          }
          break;
        }
        case 'add_file':
        case 'change': {
          if (type === 'add_file') {
            this.#size++;
          }

          let content = '';

          /**
           * @note This check is purely for the editor. The way we detect this is not
           * bullet-proof and it's a best guess so there might be false-positives.
           * The reason we do this is because we don't want to display binary files
           * in the editor nor allow to edit them.
           */
          const isBinary = isBinaryFile(buffer);

          if (!isBinary) {
            content = this.#decodeFileContent(buffer);
          }

          this.files.setKey(getAbsolutePath(sanitizedPath), {
            type: 'file',

            file: {
              content,
              isBinary
            }
          });

          break;
        }
        case 'remove_file': {
          this.#size--;
          this.files.setKey(getAbsolutePath(sanitizedPath), undefined);
          break;
        }
        case 'update_directory': {
          // we don't care about these events
          break;
        }
      }
    }
  }

  #decodeFileContent(buffer?: Uint8Array) {
    if (!buffer || buffer.byteLength === 0) {
      return '';
    }

    try {
      return utf8TextDecoder.decode(buffer);
    } catch (error) {
      console.log(error);
      return '';
    }
  }
}

function isBinaryFile(buffer: Uint8Array | undefined) {
  if (buffer === undefined) {
    return false;
  }

  return getEncoding(convertToBuffer(buffer), { chunkLength: 100 }) === 'binary';
}

/**
 * Converts a `Uint8Array` into a Node.js `Buffer` by copying the prototype.
 * The goal is to  avoid expensive copies. It does create a new typed array
 * but that's generally cheap as long as it uses the same underlying
 * array buffer.
 */
function convertToBuffer(view: Uint8Array): Buffer {
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
}

export const FILE_EVENTS_DEBOUNCE_MS = 100;
