import type { FileSystemTree, DirectoryNode, FileNode, SymlinkNode, WebContainer } from '@webcontainer/api';
import { webcontainer } from './webcontainer';
import { formatSize } from '~/utils/formatSize';
import { EXECUTABLES } from '~/utils/constants';
import type { WorkbenchStore } from './stores/workbench';

export async function loadSnapshot(webcontainer: WebContainer, workbenchStore: WorkbenchStore, chatId?: string) {
  console.log('Loading snapshot');
  console.time('loadSnapshot');
  const compressed = await workbenchStore.downloadSnapshot(chatId);

  const decompressed = await decompressSnapshot(new Uint8Array(compressed));
  await webcontainer.mount(decompressed);
  console.timeLog('loadSnapshot', 'Mounted snapshot');

  // Mark all binaries as executable. Only log on failures binaries may be missing in
  // a subsequent snapshot.
  Promise.all(
    EXECUTABLES.map(async (absPath) => {
      const chmodProc = await webcontainer.spawn('chmod', ['+x', absPath]);
      if ((await chmodProc.exit) !== 0) {
        const output = await chmodProc.output.getReader().read();
        console.log(`Failed to chmod ${absPath}: ${output.value}`);
      }
    }),
  );
  console.timeLog('loadSnapshot', 'Marked binaries as executable');

  // After loading the snapshot, we need to load the files into the FilesStore since
  // we won't receive file events for snapshot files.
  await workbenchStore.prewarmWorkdir(webcontainer);
  console.timeLog('loadSnapshot', 'Pre-warmed workdir');

  // Mark initial snapshot as loaded after everything is done
  workbenchStore.markInitialSnapshotLoaded();

  console.timeEnd('loadSnapshot');
}

export async function buildSnapshot(format: 'json', exclude_node_modules: boolean): Promise<FileSystemTree>;
export async function buildSnapshot(format: 'binary', exclude_node_modules: boolean): Promise<Uint8Array>;
export async function buildSnapshot(
  format: 'json' | 'binary',
  exclude_node_modules: boolean,
): Promise<FileSystemTree | Uint8Array> {
  const container = await webcontainer;
  const start = Date.now();
  const excludes = exclude_node_modules ? ['.env.local', 'node_modules'] : ['.env.local'];
  const snapshot = await container.export('.', {
    excludes,
    format,
  });
  const end = Date.now();
  console.log(`Built snapshot in ${end - start}ms`);
  return snapshot;
}

export async function compressSnapshot(snapshot: Uint8Array): Promise<Uint8Array> {
  // Dynamic import only executed on the client
  if (typeof window === 'undefined') {
    throw new Error('compressSnapshot can only be used in browser environments');
  }

  const start = Date.now();
  // Dynamically load the module
  const lz4 = await import('lz4-wasm');
  const compressed = lz4.compress(snapshot);
  const end = Date.now();
  console.log(
    `Compressed snapshot ${formatSize(snapshot.length)} to ${formatSize(compressed.length)} in ${end - start}ms`,
  );
  return compressed;
}

export async function decompressSnapshot(compressed: Uint8Array): Promise<Uint8Array> {
  // Dynamic import only executed on the client
  if (typeof window === 'undefined') {
    throw new Error('decompressSnapshot can only be used in browser environments');
  }

  const start = Date.now();
  // Dynamically load the module
  const lz4 = await import('lz4-wasm');
  const decompressed = lz4.decompress(compressed);
  const end = Date.now();
  console.log(
    `Decompressed snapshot ${formatSize(compressed.length)} to ${formatSize(decompressed.length)} in ${end - start}ms`,
  );
  return decompressed;
}

// Calculate the size of files recursively and build a size tree
export function analyzeSnapshotSize(tree: FileSystemTree): {
  tree: Record<string, any>;
  totalSize: number;
} {
  const result: Record<string, any> = {};
  let totalSize = 0;

  // Process each entry in the tree
  for (const [name, node] of Object.entries(tree)) {
    if ('directory' in node) {
      // It's a directory - recurse and get size info
      const dirNode = node as DirectoryNode;
      const dirAnalysis = analyzeSnapshotSize(dirNode.directory);
      result[name] = {
        type: 'directory',
        size: dirAnalysis.totalSize,
        children: dirAnalysis.tree,
      };
      totalSize += dirAnalysis.totalSize;
    } else if ('file' in node) {
      const fileNode = node as FileNode | SymlinkNode;
      if ('contents' in fileNode.file) {
        // It's a file - calculate its size
        const fileContents = (fileNode as FileNode).file.contents;
        const fileSize =
          typeof fileContents === 'string' ? new TextEncoder().encode(fileContents).length : fileContents.length;

        result[name] = {
          type: 'file',
          size: fileSize,
        };
        totalSize += fileSize;
      } else if ('symlink' in fileNode.file) {
        // It's a symlink
        result[name] = {
          type: 'symlink',
          target: (fileNode as SymlinkNode).file.symlink,
          size: 0,
        };
      }
    }
  }

  return {
    tree: result,
    totalSize,
  };
}
