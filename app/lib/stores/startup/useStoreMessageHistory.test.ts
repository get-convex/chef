import { describe, expect, test, vi } from 'vitest';
import type { UIMessage } from '@ai-sdk/react';
import { getLastCompletePart } from './useStoreMessageHistory';

vi.mock('lz4-wasm', () => ({
  compress: (data: Uint8Array) => data,
  decompress: (data: Uint8Array) => data,
}));

function createMessage(overrides: Partial<UIMessage> = {}): UIMessage {
  return {
    id: `test-${Math.random()}`,
    role: 'user',
    parts: [
      {
        type: 'text',
        text: 'test',
      },
    ],
    ...overrides,
  };
}

function createToolInvocationPart(
  invocation: { state: 'output-available'; output: string } | { state: 'input-streaming' } | { state: 'input-available' },
) {
  const toolCallId = `test-${Math.random()}`;
  return {
    type: `tool-test` as const,
    toolCallId,
    toolName: 'test',
    input: null,
    ...invocation,
  } as any;
}

describe('getLastCompletePart', () => {
  test('returns the last complete part', () => {
    const message = createMessage({
      role: 'user',
      parts: [
        {
          type: 'text',
          text: 'test',
        },
      ],
    });
    const lastCompletePart = getLastCompletePart([message], 'submitted');

    expect(lastCompletePart).toEqual({
      messageIndex: 0,
      partIndex: 0,
      hasNextPart: false,
    });
  });

  test('returns null if there are no parts', () => {
    const lastCompletePart = getLastCompletePart([], 'submitted');

    expect(lastCompletePart).toBeNull();
  });

  test('returns null if the last part is not complete', () => {
    const assistantMessage = createMessage({
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: 'test',
        },
      ],
    });
    const lastCompletePart = getLastCompletePart([assistantMessage], 'streaming');

    expect(lastCompletePart).toBeNull();
  });

  test('returns previous part if the last part is incomplete text part', () => {
    const userMessage = createMessage({
      role: 'user',
      parts: [{ type: 'text', text: 'test' }],
    });
    const assistantMessage = createMessage({
      role: 'assistant',
      parts: [createToolInvocationPart({ state: 'output-available', output: 'something' }), { type: 'text', text: 'test' }],
    });
    const lastCompletePart = getLastCompletePart([userMessage, assistantMessage], 'streaming');

    expect(lastCompletePart).toEqual({
      messageIndex: 1,
      partIndex: 0,
      hasNextPart: true,
    });
  });

  test('returns previous part if the last part is incomplete tool invocation part', () => {
    const messageA = createMessage({
      role: 'assistant',
      parts: [{ type: 'text', text: 'test' }, createToolInvocationPart({ state: 'input-streaming' })],
    });
    const lastCompletePart = getLastCompletePart([messageA], 'streaming');

    expect(lastCompletePart).toEqual({
      messageIndex: 0,
      partIndex: 0,
      hasNextPart: true,
    });
  });

  test('returns previous part if there are empty messages', () => {
    const message1 = createMessage({
      role: 'assistant',
      parts: [{ type: 'text', text: 'test' }, createToolInvocationPart({ state: 'output-available', output: 'something' })],
    });
    const message2 = createMessage({
      role: 'assistant',
      parts: [],
    });
    const lastCompletePart = getLastCompletePart([message1, message2], 'streaming');

    expect(lastCompletePart).toEqual({
      messageIndex: 0,
      partIndex: 1,
      hasNextPart: true,
    });
  });
});
