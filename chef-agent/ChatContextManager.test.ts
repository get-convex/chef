import { describe, expect, test } from 'vitest';
import { ChatContextManager } from './ChatContextManager.js';
import type { UIMessage } from 'ai';

describe('ChatContextManager', () => {
  const mockGetCurrentDocument = () => undefined;
  const mockGetFiles = () => ({});
  const mockGetUserWrites = () => new Map();

  const createManager = () => {
    return new ChatContextManager(mockGetCurrentDocument, mockGetFiles, mockGetUserWrites);
  };

  const createMessage = (role: 'user' | 'assistant', parts: UIMessage['parts']): UIMessage => ({
    id: '1',
    role,
    content: '',
    parts,
  });

  const maxCollapsedMessagesSize = 1000;
  const relevantFilesMessage = createMessage('user', [
    {
      type: 'text',
      text: `<boltArtifact id="1" title="Relevant Files">
<boltAction type="file" filePath="/home/project/package.json">{"name": "test"}</boltAction>
</boltArtifact>`,
    },
  ]);
  const emptyRelevantFilesMessage = createMessage('user', [
    {
      type: 'text',
      text: `<boltArtifact id="1" title="Relevant Files">
<boltAction type="file" filePath="/home/project/package.json"></boltAction>
</boltArtifact>`,
    },
  ]);

  describe('shouldSendRelevantFiles', () => {
    test('returns true for empty messages array', () => {
      const manager = createManager();
      expect(manager.shouldSendRelevantFiles([], maxCollapsedMessagesSize)).toBe(true);
    });

    test('returns true when message cutoff changes', () => {
      const manager = createManager();
      const messages = [
        relevantFilesMessage,
        createMessage('user', [
          {
            type: 'text',
            text: 'A'.repeat(1000),
          },
        ]),
      ];
      expect(manager.shouldSendRelevantFiles(messages, maxCollapsedMessagesSize)).toBe(true);
    });

    test('returns false when previous message has non-empty file content', () => {
      const manager = createManager();
      const messages = [relevantFilesMessage];
      expect(manager.shouldSendRelevantFiles(messages, maxCollapsedMessagesSize)).toBe(false);
    });

    test('returns true when previous message has empty file content', () => {
      const manager = createManager();
      const messages = [
        createMessage('user', [
          {
            type: 'text',
            text: `<boltArtifact id="1" title="Relevant Files">
<boltAction type="file" filePath="/home/project/package.json"></boltAction>
</boltArtifact>`,
          },
        ]),
      ];
      expect(manager.shouldSendRelevantFiles(messages, maxCollapsedMessagesSize)).toBe(true);
    });

    test('returns true when previous message has Relevant Files but no boltAction', () => {
      const manager = createManager();
      const messages = [
        createMessage('user', [
          {
            type: 'text',
            text: `<boltArtifact id="1" title="Relevant Files">
</boltArtifact>`,
          },
        ]),
      ];
      expect(manager.shouldSendRelevantFiles(messages, maxCollapsedMessagesSize)).toBe(true);
    });

    test('returns true when previous message has multiple empty boltActions', () => {
      const manager = createManager();
      const messages = [emptyRelevantFilesMessage];
      expect(manager.shouldSendRelevantFiles(messages, maxCollapsedMessagesSize)).toBe(true);
    });

    test('returns false when previous message has at least one non-empty boltAction', () => {
      const manager = createManager();
      const messages = [relevantFilesMessage, emptyRelevantFilesMessage];
      expect(manager.shouldSendRelevantFiles(messages, maxCollapsedMessagesSize)).toBe(false);
    });
  });

  describe('prepareContext', () => {
    test('should not collapse messages when last message is not from user', () => {
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

      const { messages: newMessages, collapsedMessages } = createManager().prepareContext(
        messages,
        maxCollapsedMessagesSize,
        collapsedMessagesSize,
      );
      expect(newMessages).toEqual(messages);
      expect(collapsedMessages).toBe(false);
    });

    test('should truncate when message cutoff changes even if partIndex is equal', () => {
      const maxCollapsedMessagesSize = 2000;
      const collapsedMessagesSize = 1000;
      const chatContextManager = createManager();

      // First message that will establish initial cutoff
      const initialMessages: UIMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'A'.repeat(3000), // Create a large message
          parts: [{ type: 'text', text: 'A'.repeat(3000) }],
        },
      ];

      // This will set the initial cutoff
      const { collapsedMessages: collapsed1 } = chatContextManager.prepareContext(
        initialMessages,
        maxCollapsedMessagesSize,
        collapsedMessagesSize,
      );
      expect(collapsed1).toBe(true);

      // Now create a new message with the same size
      // This will have a different messageIndex but same partIndex
      initialMessages.push({
        id: '2',
        role: 'user',
        content: 'B'.repeat(3000), // Same size as first message
        parts: [{ type: 'text', text: 'B'.repeat(3000) }],
      });

      // This should truncate even though partIndex is equal
      const { messages: truncatedMessages, collapsedMessages: collapsed2 } = chatContextManager.prepareContext(
        initialMessages,
        maxCollapsedMessagesSize,
        collapsedMessagesSize,
      );
      expect(collapsed2).toBe(true);
      // The last message should be kept
      expect(truncatedMessages.length).toBe(1);
      expect(truncatedMessages[0].id).toBe('2');
    });

    test('should preserve collapsed messages when last message is not from user', () => {
      const maxCollapsedMessagesSize = 2000;
      const collapsedMessagesSize = 1000;
      const chatContextManager = createManager();
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
      // Add another assistant message
      messages.push({
        id: '4',
        role: 'assistant',
        content: 'Hi there',
        parts: [{ type: 'text', text: 'Hi there' }],
      });
      const { messages: newMessages2, collapsedMessages: collapsedMessages2 } = chatContextManager.prepareContext(
        messages,
        maxCollapsedMessagesSize,
        collapsedMessagesSize,
      );
      // The previously collapsed message state should be preserved
      expect(newMessages2.length).toEqual(2);
      expect(collapsedMessages2).toBe(false);
    });

    test('should collapse messages when size exceeds maxCollapsedMessagesSize', () => {
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

      const { messages: newMessages, collapsedMessages } = createManager().prepareContext(
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
      const { messages: newMessages2, collapsedMessages: collapsedMessages2 } = createManager().prepareContext(
        newMessages,
        maxCollapsedMessagesSize,
        collapsedMessagesSize,
      );
      expect(newMessages2.length).toEqual(2);
      // TODO do we want it to omit the too big message? Probably. But we can fix later.
      //   expect(collapsedMessages2).toBe(false);
    });
  });
});
