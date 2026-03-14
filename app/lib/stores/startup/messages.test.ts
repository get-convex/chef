import { expect, test, describe, vi } from 'vitest';
import type { UIMessage } from '@ai-sdk/react';
import { serializeMessageForConvex } from './messages';

vi.mock('lz4-wasm', () => ({
  compress: (data: Uint8Array) => data,
  decompress: (data: Uint8Array) => data,
}));

describe('serializeMessageForConvex', () => {
  test('preserves non-text parts', () => {
    const message: UIMessage = {
      id: 'test',
      role: 'user',
      parts: [
        {
          type: 'text',
          text: 'some content',
        },
      ],
    };

    const serialized = serializeMessageForConvex(message);

    expect(serialized.parts?.[0]).toEqual({
      type: 'text',
      text: 'some content',
    });
  });
});
