import type { UIMessage } from 'ai';
import { type AbsolutePath, getAbsolutePath } from './utils/workDir.js';
import { type Dirent, type EditorDocument, type FileMap } from './types.js';
import { PREWARM_PATHS, WORK_DIR } from './constants.js';
import { renderFile } from './utils/renderFile.js';
import { StreamingMessageParser } from './message-parser.js';
import { makePartId, type PartId } from './partId.js';
import { viewParameters } from './tools/view.js';
import { editToolParameters } from './tools/edit.js';
import { loggingSafeParse } from './utils/zodUtil.js';
import { npmInstallToolParameters } from './tools/npmInstall.js';
import { path } from './utils/path.js';

const MAX_RELEVANT_FILES = 16;

type UIMessagePart = UIMessage['parts'][number];

export type PromptCharacterCounts = {
  messageHistoryChars: number;
  currentTurnChars: number;
  totalPromptChars: number;
};

type ParsedAssistantMessage = {
  filesTouched: Map<AbsolutePath, number>;
};

export class ChatContextManager {
  assistantMessageCache: WeakMap<UIMessage, ParsedAssistantMessage> = new WeakMap();
  messageSizeCache: WeakMap<UIMessage, number> = new WeakMap();
  partSizeCache: WeakMap<UIMessagePart, number> = new WeakMap();
  messageIndex: number = -1;
  partIndex: number = -1;

  constructor(
    private getCurrentDocument: () => EditorDocument | undefined,
    private getFiles: () => FileMap,
    private getUserWrites: () => Map<AbsolutePath, number>,
  ) {}

  /**
   * Reset the context manager state. This should be called when switching
   * between subchats to prevent stale message indices from causing errors.
   */
  reset(): void {
    this.assistantMessageCache = new WeakMap();
    this.messageSizeCache = new WeakMap();
    this.partSizeCache = new WeakMap();
    this.messageIndex = -1;
    this.partIndex = -1;
  }

  /**
   * Our request context has a few sections:
   *
   * 1. The Convex guidelines, which are filled in by the server and
   *    set to be cached by Anthropic (~15k tokens).
   * 2. Some relevant project files, which are filled in from the file
   *    cache based on LRU, up to maxRelevantFilesSize.
   * 3. A potentially collapsed segment of the chat history followed
   *    by the full fidelity recent chat history, up to maxCollapsedMessagesSize.
   */
  prepareContext(
    messages: UIMessage[],
    maxCollapsedMessagesSize: number,
    minCollapsedMessagesSize: number,
  ): { messages: UIMessage[]; collapsedMessages: boolean; promptCharacterCounts?: PromptCharacterCounts } {
    // If the last message is a user message this is the first LLM call that includes that user message.
    // Only update the relevant files and the message cutoff indices if the last message is a user message to avoid clearing the cache as the agent makes changes.
    let collapsedMessages = false;
    if (messages[messages.length - 1].role === 'user') {
      const [messageIndex, partIndex] = this.messagePartCutoff(messages, maxCollapsedMessagesSize);
      if (messageIndex == this.messageIndex && partIndex == this.partIndex) {
        return { messages, collapsedMessages };
      }
      if (messageIndex >= this.messageIndex && partIndex >= this.partIndex) {
        // Truncate more than just the `maxCollapsedMessagesSize` limit because we want to get some cache hits before needing to truncate again.
        // If we only truncate to the `maxCollapsedMessagesSize` limit, we'll keep truncating on each new message, which means cache misses.
        const [newMessageIndex, newPartIndex] = this.messagePartCutoff(messages, minCollapsedMessagesSize);
        this.messageIndex = newMessageIndex;
        this.partIndex = newPartIndex;
        collapsedMessages = true;
      }
    }
    messages = this.collapseMessages(messages);
    return { messages, collapsedMessages };
  }

  /**
   * Calculate character counts for different parts of the prompt
   */
  calculatePromptCharacterCounts(messages: UIMessage[], systemPrompts?: string[]): PromptCharacterCounts {
    // Calculate message history character count (excluding current turn)
    let messageHistoryChars = 0;
    const lastMessage = messages[messages.length - 1];
    const isLastMessageUser = lastMessage?.role === 'user';

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      // Skip the current turn (last message if it's from user)
      if (isLastMessageUser && i === messages.length - 1) {
        continue;
      }
      messageHistoryChars += this.messageSize(message);
    }

    // Calculate current turn character count
    let currentTurnChars = 0;
    if (isLastMessageUser) {
      currentTurnChars = this.messageSize(lastMessage);
    }

    // Calculate system prompts character count (if provided)
    let systemPromptsChars = 0;
    if (systemPrompts) {
      systemPromptsChars = systemPrompts.reduce((sum, prompt) => sum + prompt.length, 0);
    }

    const totalPromptChars = messageHistoryChars + currentTurnChars + systemPromptsChars;

    return {
      messageHistoryChars,
      currentTurnChars,
      totalPromptChars,
    };
  }

  private messageSize(message: UIMessage): number {
    const cached = this.messageSizeCache.get(message);
    if (cached !== undefined) {
      return cached;
    }

    let size = 0;
    for (const part of message.parts) {
      size += this.partSize(part);
    }

    this.messageSizeCache.set(message, size);
    return size;
  }

  relevantFiles(messages: UIMessage[], id: string, maxRelevantFilesSize: number): UIMessage {
    const currentDocument = this.getCurrentDocument();
    const cache = this.getFiles();
    const allPaths = Object.keys(cache).sort();

    const lastUsed: Map<AbsolutePath, number> = new Map();
    for (const path of PREWARM_PATHS) {
      const absPath = path as AbsolutePath;
      const entry = cache[absPath];
      if (!entry) {
        continue;
      }
      lastUsed.set(absPath, 0);
    }

    let partCounter = 0;
    for (const message of messages) {
      const parsed = this.parsedAssistantMessage(message);
      if (!parsed) {
        continue;
      }
      for (const [absPath, partIndex] of parsed.filesTouched.entries()) {
        const entry = cache[absPath];
        if (!entry || entry.type !== 'file') {
          continue;
        }
        const lastUsedTime = partCounter + partIndex;
        lastUsed.set(absPath, lastUsedTime);
      }
      partCounter += message.parts.length;
    }

    for (const [path, lastUsedTime] of this.getUserWrites().entries()) {
      const existing = lastUsed.get(path) ?? 0;
      lastUsed.set(path, Math.max(existing, lastUsedTime));
    }

    if (currentDocument) {
      lastUsed.delete(currentDocument.filePath);
    }

    const sortedByLastUsed = Array.from(lastUsed.entries()).sort((a, b) => b[1] - a[1]);
    let sizeEstimate = 0;
    const fileActions: string[] = [];
    let numFiles = 0;

    for (const [path] of sortedByLastUsed) {
      if (sizeEstimate > maxRelevantFilesSize) {
        break;
      }
      if (numFiles >= MAX_RELEVANT_FILES) {
        break;
      }
      const entry = cache[path];
      if (!entry) {
        continue;
      }
      if (entry.type === 'file') {
        const content = renderFile(entry.content);
        fileActions.push(`<boltAction type="file" filePath="${path}">${content}</boltAction>`);
        const size = estimateSize(entry);
        sizeEstimate += size;
        numFiles++;
      }
    }

    if (currentDocument) {
      const content = renderFile(currentDocument.value);
      fileActions.push(`<boltAction type="file" filePath="${currentDocument.filePath}">${content}</boltAction>`);
    }

    // Compose a single message with all relevant files
    if (allPaths.length > 0) {
      fileActions.push(`Here are all the paths in the project:\n${allPaths.map((p) => ` - ${p}`).join('\n')}\n\n`);
    }
    if (fileActions.length === 0) {
      return {
        id,
        role: 'user',
        parts: [],
      };
    }
    return makeUserMessage(fileActions, id);
  }

  private collapseMessages(messages: UIMessage[]): UIMessage[] {
    const fullMessages = [];
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      if (i < this.messageIndex) {
        continue;
      } else if (i === this.messageIndex) {
        const filteredParts = message.parts.filter((p, j) => {
          if (!('toolCallId' in p) || (p as any).state !== 'output-available') {
            return true;
          }
          return j > this.partIndex;
        });
        // Strip artifacts from any text parts in the collapsed message
        const strippedParts = filteredParts.map((p) => {
          if (p.type === 'text') {
            return { ...p, text: StreamingMessageParser.stripArtifacts(p.text) };
          }
          return p;
        });
        const remainingMessage = {
          ...message,
          parts: strippedParts,
        };
        fullMessages.push(remainingMessage);
      } else {
        fullMessages.push(message);
      }
    }
    const result: UIMessage[] = [];
    result.push(...fullMessages);
    return result;
  }

  shouldSendRelevantFiles(messages: UIMessage[], maxCollapsedMessagesSize: number): boolean {
    // Always send files on the first message
    if (messages.length === 0) {
      return true;
    }

    // Check if we are going to collapse messages, if so, send new files
    const [messageIndex, partIndex] = this.messagePartCutoff(messages, maxCollapsedMessagesSize);
    if (messageIndex != this.messageIndex || partIndex != this.partIndex) {
      return true;
    }

    // Check if any previous messages contain file artifacts with non-empty content
    for (const message of messages) {
      if (message.role === 'user') {
        for (const part of message.parts) {
          if (part.type === 'text' && part.text.includes('title="Relevant Files"')) {
            // Check if there's actual content between the boltAction tags
            // We used to strip out the file content when serializing messages to store in Convex
            const hasContent =
              part.text.includes('<boltAction type="file"') && !part.text.match(/<boltAction[^>]*><\/boltAction>/);
            if (hasContent) {
              // Only return false if we found a message with actual file content
              return false;
            }
          }
        }
      }
    }
    return true;
  }

  private messagePartCutoff(messages: UIMessage[], maxCollapsedMessagesSize: number): [number, number] {
    let remaining = maxCollapsedMessagesSize;
    for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex--) {
      const message = messages[messageIndex];
      for (let partIndex = message.parts.length - 1; partIndex >= 0; partIndex--) {
        const part = message.parts[partIndex];
        if ('toolCallId' in part && (part as any).state !== 'output-available') {
          continue;
        }
        const size = this.partSize(part);
        if (size > remaining) {
          return [messageIndex, partIndex];
        }
        remaining -= size;
      }
    }
    return [-1, -1];
  }

  private parsedAssistantMessage(message: UIMessage): ParsedAssistantMessage | null {
    if (message.role !== 'assistant') {
      return null;
    }
    const cached = this.assistantMessageCache.get(message);
    if (cached) {
      return cached;
    }

    const filesTouched = new Map<AbsolutePath, number>();
    for (let j = 0; j < message.parts.length; j++) {
      const part = message.parts[j];
      if (part.type === 'text') {
        const files = extractFileArtifacts(makePartId(message.id, j), part.text);
        for (const file of files) {
          filesTouched.set(getAbsolutePath(file), j);
        }
      }
      if ('toolCallId' in part) {
        const toolPart = part as any;
        if (toolPart.toolName == 'view' && toolPart.state !== 'input-streaming') {
          const args = loggingSafeParse(viewParameters, toolPart.input);
          if (args.success) {
            filesTouched.set(getAbsolutePath(args.data.path), j);
          }
        }
        if (toolPart.toolName == 'edit' && toolPart.state !== 'input-streaming') {
          const args = loggingSafeParse(editToolParameters, toolPart.input);
          if (args.success) {
            filesTouched.set(getAbsolutePath(args.data.path), j);
          }
        }
      }
    }
    const result = {
      filesTouched,
    };
    this.assistantMessageCache.set(message, result);
    return result;
  }

  private partSize(part: UIMessagePart) {
    const cached = this.partSizeCache.get(part);
    if (cached) {
      return cached;
    }
    let result = 0;
    switch (part.type) {
      case 'text':
        result = part.text.length;
        break;
      case 'file':
        result += part.url.length;
        result += part.mediaType.length;
        break;
      case 'reasoning':
        result += part.text.length;
        break;
      case 'step-start':
        break;
      default:
        // Handle tool parts (type starts with 'tool-' or has toolCallId)
        if ('toolCallId' in part) {
          const toolPart = part as any;
          result += JSON.stringify(toolPart.input ?? {}).length;
          if (toolPart.state === 'output-available') {
            result += JSON.stringify(toolPart.output ?? '').length;
          }
        } else if (part.type === 'source-url') {
          result += ((part as any).title ?? '').length;
          result += ((part as any).url ?? '').length;
        } else {
          // Unknown part type, estimate with JSON serialization
          result += JSON.stringify(part).length;
        }
    }
    this.partSizeCache.set(part, result);
    return result;
  }
}

function makeUserMessage(content: string[], id: string): UIMessage {
  const parts: UIMessagePart[] = content.map((c) => ({
    type: 'text',
    // N.B. Do not change this title "Relevant Files" without also updating `extractUrlHintAndDescription`. It's super jank
    text: `<boltArtifact id="${id}" title="Relevant Files">
${c}
</boltArtifact>`,
  }));
  return {
    id,
    role: 'user',
    parts,
  };
}

function estimateSize(entry: Dirent): number {
  if (entry.type === 'file') {
    return 4 + entry.content.length;
  } else {
    return 6;
  }
}

function abbreviateToolInvocation(toolPart: { toolName: string; state: string; input?: any; output?: any }): string {
  if (toolPart.state !== 'output-available') {
    throw new Error(`Invalid tool invocation state: ${toolPart.state}`);
  }
  const output = typeof toolPart.output === 'string' ? toolPart.output : '';
  const wasError = output.startsWith('Error:');
  let toolCall: string;
  switch (toolPart.toolName) {
    case 'view': {
      const args = loggingSafeParse(viewParameters, toolPart.input);
      let verb = 'viewed';
      if (output.startsWith('Directory:')) {
        verb = 'listed';
      }
      toolCall = `${verb} ${args?.data?.path || 'unknown file'}`;
      break;
    }
    case 'deploy': {
      toolCall = `deployed the app`;
      break;
    }
    case 'npmInstall': {
      const args = loggingSafeParse(npmInstallToolParameters, toolPart.input);
      if (args.success) {
        toolCall = `installed the dependencies ${args.data.packages}`;
      } else {
        toolCall = `attempted to install dependencies`;
      }
      break;
    }
    case 'edit': {
      const args = loggingSafeParse(editToolParameters, toolPart.input);
      if (args.success) {
        toolCall = `edited the file ${args.data.path}`;
      } else {
        toolCall = `attempted to edit a file`;
      }
      break;
    }
    case 'getConvexDeploymentName': {
      toolCall = `retrieved the Convex deployment name`;
      break;
    }
    default:
      throw new Error(`Unknown tool name: ${toolPart.toolName}`);
  }
  return `The assistant ${toolCall} ${wasError ? 'and got an error' : 'successfully'}.`;
}

function extractFileArtifacts(partId: PartId, content: string) {
  const filesTouched: Set<string> = new Set();
  const parser = new StreamingMessageParser({
    callbacks: {
      onActionClose: (data) => {
        if (data.action.type === 'file') {
          const relPath = data.action.filePath;
          const absPath = path.join(WORK_DIR, relPath);
          filesTouched.add(absPath);
        }
      },
    },
  });
  parser.parse(partId, content);
  return Array.from(filesTouched);
}
