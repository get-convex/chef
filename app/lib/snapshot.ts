import { IGNORED_RELATIVE_PATHS } from '~/utils/constants';
import { webcontainer } from './webcontainer';

export async function buildUncompressedSnapshot(): Promise<Uint8Array> {
  const container = await webcontainer;
  const start = Date.now();
  const snapshot = await container.export('.', {
    excludes: IGNORED_RELATIVE_PATHS,
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

  // Dynamically load the module
  const lz4 = await import('lz4-wasm');
  const compressed = lz4.compress(snapshot);
  return compressed;
}

export async function decompressSnapshot(compressed: Uint8Array): Promise<Uint8Array> {
  // Dynamic import only executed on the client
  if (typeof window === 'undefined') {
    throw new Error('decompressSnapshot can only be used in browser environments');
  }

  // Dynamically load the module
  const lz4 = await import('lz4-wasm');
  const decompressed = lz4.decompress(compressed);
  return decompressed;
}
