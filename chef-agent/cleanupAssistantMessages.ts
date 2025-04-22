import { convertToCoreMessages } from 'ai';
import type { Message } from 'ai';

export function cleanupAssistantMessages(messages: Message[]) {
  let processedMessages = messages.map((message) => {
    if (message.role == 'assistant') {
      let content = message.content;
      content = content.replace(/<div class=\\"__boltThought__\\">.*?<\/div>/s, '');
      content = content.replace(/<think>.*?<\/think>/s, '');
      // We prevent the LLM from modifying `convex/auth.ts`
      content = content.replace(
        /<boltAction type="file" filePath="convex\/auth\.ts"[^>]*>[\s\S]*?<\/boltAction>/g,
        'You tried to modify `convex/auth.ts` but this is not allowed. Please modify a different file.',
      );
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
