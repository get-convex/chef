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
});
