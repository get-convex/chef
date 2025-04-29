import * as lz4 from 'lz4-wasm';

export function compressWithLz4(uint8Array: Uint8Array): Uint8Array {
  const compressed = lz4.compress(uint8Array);
  return compressed;
}

export function decompressWithLz4(uint8Array: Uint8Array): Uint8Array {
  const decompressed = lz4.decompress(uint8Array);
  return decompressed;
}
