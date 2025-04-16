import * as lz4 from 'lz4-wasm';

export function compressWithLz4(uint8Array: Uint8Array): Uint8Array {
  // Dynamic import only executed on the client
  if (typeof window === 'undefined') {
    throw new Error('compressWithLz4 can only be used in browser environments');
  }
  const compressed = lz4.compress(uint8Array);
  return compressed;
}

export function decompressWithLz4(uint8Array: Uint8Array): Uint8Array {
  // Dynamic import only executed on the client
  if (typeof window === 'undefined') {
    throw new Error('decompressWithLz4 can only be used in browser environments');
  }
  const decompressed = lz4.decompress(uint8Array);
  return decompressed;
}
