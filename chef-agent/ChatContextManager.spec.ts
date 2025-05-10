import { describe, expect, it, beforeEach } from 'vitest';
import { ChatContextManager } from './ChatContextManager.js';
import type { UIMessage } from 'ai';
import type { EditorDocument, FileMap } from './types';

describe('ChatContextManager', () => {
  let chatContextManager: ChatContextManager;
  let mockGetCurrentDocument: () => EditorDocument | undefined;
  let mockGetFiles: () => FileMap;
  let mockGetUserWrites: () => Map<string, number>;

  beforeEach(() => {
    mockGetCurrentDocument = () => undefined;
    mockGetFiles = () => ({});
    mockGetUserWrites = () => new Map();
    chatContextManager = new ChatContextManager(mockGetCurrentDocument, mockGetFiles, mockGetUserWrites);
  });

  describe('prepareContext', () => {
    it('should not collapse messages when last message is not from user', () => {
      const maxCollapsedMessagesSize = 2000;
      const collapsedMessagesSize = 1000;
      const messages: UIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'A'.repeat(3000), // Create a large message
          parts: [{ type: 'text', text: 'A'.repeat(3000) }],
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Hi there',
          parts: [{ type: 'text', text: 'Hi there' }],
        },
      ];

      const { messages: newMessages, collapsedMessages } = chatContextManager.prepareContext(
        messages,
        maxCollapsedMessagesSize,
        collapsedMessagesSize,
      );
      expect(newMessages).toEqual(messages);
      expect(collapsedMessages).toBe(false);
    });

    it('should collapse messages when size exceeds maxCollapsedMessagesSize', () => {
      const maxCollapsedMessagesSize = 2000;
      const collapsedMessagesSize = 1000;
      const messages: UIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Hi there',
          parts: [{ type: 'text', text: 'Hi there' }],
        },
        {
          id: '3',
          role: 'user',
          content: 'A'.repeat(3000), // Create a large message
          parts: [{ type: 'text', text: 'A'.repeat(3000) }],
        },
      ];

      const { messages: newMessages, collapsedMessages } = chatContextManager.prepareContext(
        messages,
        maxCollapsedMessagesSize,
        collapsedMessagesSize,
      );
      expect(newMessages.length).toBe(1);
      // The last message is the only one that should be kept
      expect(newMessages[0].id).toBe('3');
      expect(collapsedMessages).toBe(true);

      // Should not collapse with another smaller message
      newMessages.push({
        id: '4',
        role: 'user',
        content: 'B'.repeat(100),
        parts: [],
      });
      const { messages: newMessages2, collapsedMessages: collapsedMessages2 } = chatContextManager.prepareContext(
        newMessages,
        maxCollapsedMessagesSize,
        collapsedMessagesSize,
      );
      expect(newMessages2.length).toBe(2);
      expect(collapsedMessages2).toBe(false);
    });
  });
});
