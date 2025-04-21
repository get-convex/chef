import { wasmSource } from "./lz4Wasm";

// Do some work at import time to speed `vitest` up (since it reuses the same module
// across tests, unlike the Convex runtime).
const wasmBinary = atob(wasmSource);
const wasmBuffer = new Uint8Array(wasmBinary.length);
for (let i = 0; i < wasmBinary.length; i++) {
  wasmBuffer[i] = wasmBinary.charCodeAt(i);
}

export class Lz4 {
  private instance?: WebAssembly.Instance;
  private textDecoder: TextDecoder;

  private uint8Memory0: Uint8Array | null = null;
  private int32Memory0: Int32Array | null = null;
  private wasmVectorLen: number = 0;

  private heap: any[];
  private heap_next: number;

  constructor() {
    this.textDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
    this.textDecoder.decode();

    this.heap = new Array(32).fill(undefined);
    this.heap.push(undefined, null, true, false);
    this.heap_next = this.heap.length;
  }

  static async initialize() {
    const lz4 = new Lz4();
    const { instance } = await WebAssembly.instantiate(wasmBuffer, {
      "./lz4_wasm_bg.js": {
        __wbindgen_string_new: (arg0: number, arg1: number) => {
          const ret = lz4.getStringFromWasm0(arg0, arg1);
          return lz4.addHeapObject(ret);
        },
      },
    });
    lz4.instance = instance;
    return lz4;
  }

  compress(input: Uint8Array) {
    try {
      const retptr = this.exports.__wbindgen_add_to_stack_pointer(-16);
      const ptr0 = this.passArray8ToWasm0(input, this.exports.__wbindgen_malloc);
      const len0 = this.wasmVectorLen;
      this.exports.compress(retptr, ptr0, len0);
      var r0 = this.getInt32Memory0()[retptr / 4 + 0];
      var r1 = this.getInt32Memory0()[retptr / 4 + 1];
      var v1 = this.getArrayU8FromWasm0(r0, r1).slice();
      this.exports.__wbindgen_free(r0, r1 * 1);
      return v1;
    } finally {
      this.exports.__wbindgen_add_to_stack_pointer(16);
    }
  }

  decompress(input: Uint8Array) {
    try {
      const retptr = this.exports.__wbindgen_add_to_stack_pointer(-16);
      const ptr0 = this.passArray8ToWasm0(input, this.exports.__wbindgen_malloc);
      const len0 = this.wasmVectorLen;
      this.exports.decompress(retptr, ptr0, len0);
      var r0 = this.getInt32Memory0()[retptr / 4 + 0];
      var r1 = this.getInt32Memory0()[retptr / 4 + 1];
      var r2 = this.getInt32Memory0()[retptr / 4 + 2];
      var r3 = this.getInt32Memory0()[retptr / 4 + 3];
      if (r3) {
        throw this.takeObject(r2);
      }
      var v1 = this.getArrayU8FromWasm0(r0, r1).slice();
      this.exports.__wbindgen_free(r0, r1 * 1);
      return v1;
    } finally {
      this.exports.__wbindgen_add_to_stack_pointer(16);
    }
  }

  private get exports() {
    if (!this.instance) {
      throw new Error("Lz4 instance not initialized");
    }
    return this.instance.exports as any;
  }

  private getUint8Memory0() {
    if (!this.instance) {
      throw new Error("Lz4 instance not initialized");
    }
    if (this.uint8Memory0 === null || this.uint8Memory0.buffer !== this.exports.memory.buffer) {
      this.uint8Memory0 = new Uint8Array(this.exports.memory.buffer);
    }
    return this.uint8Memory0;
  }

  private getStringFromWasm0(ptr: number, len: number) {
    return this.textDecoder.decode(this.getUint8Memory0().subarray(ptr, ptr + len));
  }

  private passArray8ToWasm0(arg: any, malloc: any) {
    const ptr = malloc(arg.length * 1);
    this.getUint8Memory0().set(arg, ptr / 1);
    this.wasmVectorLen = arg.length;
    return ptr;
  }

  private getArrayU8FromWasm0(ptr: number, len: number) {
    return this.getUint8Memory0().subarray(ptr / 1, ptr / 1 + len);
  }

  private getInt32Memory0() {
    if (!this.instance) {
      throw new Error("Lz4 instance not initialized");
    }
    if (this.int32Memory0 === null || this.int32Memory0.buffer !== this.exports.memory.buffer) {
      this.int32Memory0 = new Int32Array(this.exports.memory.buffer);
    }
    return this.int32Memory0;
  }

  private addHeapObject(obj: any) {
    if (this.heap_next === this.heap.length) {
      this.heap.push(this.heap.length + 1);
    }
    const idx = this.heap_next;
    this.heap_next = this.heap[idx];
    this.heap[idx] = obj;
    return idx;
  }

  private getObject(idx: number) {
    return this.heap[idx];
  }

  private dropObject(idx: number) {
    this.heap[idx] = this.heap_next;
  }

  private takeObject(idx: number) {
    const ret = this.getObject(idx);
    this.dropObject(idx);
    return ret;
  }
}
