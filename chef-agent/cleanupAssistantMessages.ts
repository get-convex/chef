import { convertToCoreMessages } from 'ai';
import type { Message } from 'ai';
import { EXCLUDED_FILE_PATHS } from './constants.js';

export function cleanupAssistantMessages(messages: Message[]) {
  let processedMessages = messages.map((message) => {
    if (message.role == 'assistant') {
      let content = message.content;
      content = content.replace(/<div class=\\"__boltThought__\\">.*?<\/div>/s, '');
      content = content.replace(/<think>.*?<\/think>/s, '');
      // We prevent the LLM from modifying a list of files
      for (const excludedPath of EXCLUDED_FILE_PATHS) {
        const escapedPath = excludedPath.replace(/\//g, '\\/');
        content = content.replace(
          new RegExp(`<boltAction type="file" filePath="${escapedPath}"[^>]*>[\\s\\S]*?<\\/boltAction>`, 'g'),
          `You tried to modify \`${excludedPath}\` but this is not allowed. Please modify a different file.`,
        );
      }
      return { ...message, content };
    } else {
      return message;
    }
  });
  // Filter out empty messages and messages with empty parts
  processedMessages = processedMessages.filter(
    (message) => message.content.trim() !== '' || (message.parts && message.parts.length > 0),
  );
  return convertToCoreMessages(processedMessages);
}
