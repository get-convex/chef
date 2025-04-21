import { fc, test as fcTest } from "@fast-check/vitest";
import { Lz4 } from "./lz4";

fcTest.prop({ buffer: fc.uint8Array({ minLength: 0, maxLength: 1024 }) })("lz4 roundtrips", async ({ buffer }) => {
  const lz4 = await Lz4.initialize();
  const compressed = lz4.compress(buffer);
  const decompressed = lz4.decompress(compressed);
  return decompressed.length === buffer.length && decompressed.every((value, index) => value === buffer[index]);
});
