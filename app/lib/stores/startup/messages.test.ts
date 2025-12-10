import { expect, test, describe, vi } from 'vitest';
import { serializeMessageForConvex } from './messages';

vi.mock('lz4-wasm', () => ({
  compress: (data: Uint8Array) => data,
  decompress: (data: Uint8Array) => data,
}));

describe('serializeMessageForConvex', () => {
  test('preserves non-text parts', () => {
    // Using any for backwards compatibility with legacy message format
    const message: any = {
      id: 'test',
      role: 'user',
      content: '',
      parts: [
        {
          type: 'text',
          text: 'some content',
        },
      ],
      createdAt: new Date(),
    };

    const serialized = serializeMessageForConvex(message);

    expect(serialized.parts?.[0]).toEqual({
      type: 'text',
      text: 'some content',
    });
  });
});
