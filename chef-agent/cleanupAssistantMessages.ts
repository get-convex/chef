import { convertToCoreMessages, isToolUIPart, type UIMessage } from 'ai';
import { EXCLUDED_FILE_PATHS } from './constants.js';

// Legacy message type for backwards compatibility with stored data
type LegacyMessage = UIMessage & {
  content?: string;
  annotations?: unknown[];
  toolInvocations?: unknown[];
};

export function cleanupAssistantMessages(messages: LegacyMessage[]) {
  let processedMessages = messages.map((message) => {
    if (message.role == 'assistant') {
      // Get content from parts or legacy content property
      const originalContent = message.content ?? '';
      let content = cleanMessage(originalContent);
      let parts = message.parts?.map((part: any) => {
        if (part.type === 'text') {
          part.text = cleanMessage(part.text);
        }
        return part;
      });
      return { ...message, content, parts };
    } else {
      return message;
    }
  });
  // Filter out empty messages and messages with empty parts
  // In AI SDK 5, tool parts use isToolUIPart helper instead of type === 'tool-invocation'
  processedMessages = processedMessages.filter(
    (message) =>
      (message.content ?? '').trim() !== '' ||
      (message.parts &&
        message.parts.filter(
          (part: any) => part.type === 'text' || isToolUIPart(part) || part.type === 'tool-invocation',
        ).length > 0),
  );
  return convertToCoreMessages(processedMessages as any).filter((message) => message.content.length > 0);
}

function cleanMessage(message: string) {
  message = message.replace(/<div class=\\"__boltThought__\\">.*?<\/div>/s, '');
  message = message.replace(/<think>.*?<\/think>/s, '');
  // We prevent the LLM from modifying a list of files
  for (const excludedPath of EXCLUDED_FILE_PATHS) {
    const escapedPath = excludedPath.replace(/\//g, '\\/');
    message = message.replace(
      new RegExp(`<boltAction type="file" filePath="${escapedPath}"[^>]*>[\\s\\S]*?<\\/boltAction>`, 'g'),
      `You tried to modify \`${excludedPath}\` but this is not allowed. Please modify a different file.`,
    );
  }
  return message;
}
