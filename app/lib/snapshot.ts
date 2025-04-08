import type { WebContainer } from '@webcontainer/api';
import { webcontainer } from './webcontainer';
import { formatSize } from '~/utils/formatSize';
import type { WorkbenchStore } from './stores/workbench';
import { streamOutput } from '~/utils/process';

export async function loadSnapshot(webcontainer: WebContainer, workbenchStore: WorkbenchStore, chatId?: string) {
  console.log('Loading snapshot');
  console.time('loadSnapshot');
  const compressed = await workbenchStore.downloadSnapshot(chatId);

  const decompressed = await decompressSnapshot(new Uint8Array(compressed));
  await webcontainer.mount(decompressed);
  console.timeLog('loadSnapshot', 'Mounted snapshot');

  // Install NPM dependencies.
  const npm = await webcontainer.spawn('npm', ['install']);
  const { output, exitCode } = await streamOutput(npm, {
    onOutput: (output) => {
      console.log('npm output', output);
    },
    debounceMs: 1000,
  });
  if (exitCode !== 0) {
    throw new Error(`Npm install failed with exit code ${exitCode}: ${output}`);
  }

  // After loading the snapshot, we need to load the files into the FilesStore since
  // we won't receive file events for snapshot files.
  await workbenchStore.prewarmWorkdir(webcontainer);
  console.timeLog('loadSnapshot', 'Pre-warmed workdir');

  // Mark initial snapshot as loaded after everything is done
  workbenchStore.markInitialSnapshotLoaded();

  console.timeEnd('loadSnapshot');
}

export async function buildUncompressedSnapshot(): Promise<Uint8Array> {
  const container = await webcontainer;
  const start = Date.now();
  const snapshot = await container.export('.', {
    excludes: ['.env.local', 'node_modules'],
    format: 'binary',
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