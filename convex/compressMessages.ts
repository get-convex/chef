import { Lz4 } from "./lz4";
import type { SerializedMessage } from "./messages";

export async function compressMessages(messages: SerializedMessage[]) {
  const lz4 = await Lz4.initialize();
  const compressed = lz4.compress(new TextEncoder().encode(JSON.stringify(messages)));
  return compressed;
}

export async function decompressMessages(response: Response) {
  const lz4 = await Lz4.initialize();
  const compressed = await response.arrayBuffer();
  const decompressed = lz4.decompress(new Uint8Array(compressed));
  return JSON.parse(new TextDecoder().decode(decompressed));
}
