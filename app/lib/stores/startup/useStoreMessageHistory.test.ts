import { describe, expect, test } from 'vitest';
import type { Message } from '@ai-sdk/react';
import { serializeMessageForConvex } from './useStoreMessageHistory';

describe('serializeMessageForConvex', () => {
  test('removes file content from bolt actions while preserving tags', () => {
    const message: Message = {
      id: 'test',
      role: 'user',
      content: '',
      parts: [
        {
          type: 'text',
          text: 'Here is a file:\n<boltAction type="file" filePath="test.ts">\nconst x = 1;\n</boltAction>\nAnd some more text',
        },
      ],
      createdAt: new Date(),
    };

    const serialized = serializeMessageForConvex(message);

    expect(serialized.parts?.[0]).toEqual({
      type: 'text',
      text: 'Here is a file:\n<boltAction type="file" filePath="test.ts"></boltAction>\nAnd some more text',
    });
  });

  test('preserves non-file bolt actions', () => {
    const message: Message = {
      id: 'test',
      role: 'user',
      content: '',
      parts: [
        {
          type: 'text',
          text: '<boltAction type="other">content</boltAction>',
        },
      ],
      createdAt: new Date(),
    };

    const serialized = serializeMessageForConvex(message);

    expect(serialized.parts?.[0]).toEqual({
      type: 'text',
      text: '<boltAction type="other">content</boltAction>',
    });
  });

  test('preserves non-text parts', () => {
    const message: Message = {
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
