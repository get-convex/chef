import { type UIToolInvocation, type UIMessage, isToolUIPart, getToolName } from 'ai';
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

// Legacy message type with content string for backwards compatibility
interface LegacyUIMessage extends UIMessage {
  content?: string;
  createdAt?: Date;
  annotations?: unknown[];
}

export type PromptCharacterCounts = {
  messageHistoryChars: number;
  currentTurnChars: number;
  totalPromptChars: number;
};

type ParsedAssistantMessage = {
  filesTouched: Map<AbsolutePath, number>;
};

export class ChatContextManager {
  assistantMessageCache: WeakMap<LegacyUIMessage, ParsedAssistantMessage> = new WeakMap();
  messageSizeCache: WeakMap<LegacyUIMessage, number> = new WeakMap();
  partSizeCache: WeakMap<any, number> = new WeakMap();
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
    messages: LegacyUIMessage[],
    maxCollapsedMessagesSize: number,
    minCollapsedMessagesSize: number,
  ): { messages: LegacyUIMessage[]; collapsedMessages: boolean; promptCharacterCounts?: PromptCharacterCounts } {
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
  calculatePromptCharacterCounts(messages: LegacyUIMessage[], systemPrompts?: string[]): PromptCharacterCounts {
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

  private messageSize(message: LegacyUIMessage): number {
    const cached = this.messageSizeCache.get(message);
    if (cached !== undefined) {
      return cached;
    }

    // In AI SDK 5, UIMessage doesn't have content string directly
    // Use legacy content property or compute from parts
    let size = (message.content ?? '').length;
    for (const part of message.parts ?? []) {
      size += this.partSize(part as any);
    }

    this.messageSizeCache.set(message, size);
    return size;
  }

  relevantFiles(messages: LegacyUIMessage[], id: string, maxRelevantFilesSize: number): LegacyUIMessage {
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
      const createdAt = message.createdAt?.getTime();
      const parsed = this.parsedAssistantMessage(message);
      if (!parsed) {
        continue;
      }
      for (const [absPath, partIndex] of parsed.filesTouched.entries()) {
        const entry = cache[absPath];
        if (!entry || entry.type !== 'file') {
          continue;
        }
        const lastUsedTime = (createdAt ?? partCounter) + partIndex;
        lastUsed.set(absPath, lastUsedTime);
      }
      partCounter += (message.parts ?? []).length;
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
        content: '',
        role: 'user',
        parts: [],
      } as LegacyUIMessage;
    }
    return makeUserMessage(fileActions, id);
  }

  private collapseMessages(messages: LegacyUIMessage[]): LegacyUIMessage[] {
    const fullMessages: LegacyUIMessage[] = [];
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      if (i < this.messageIndex) {
        continue;
      } else if (i === this.messageIndex) {
        const filteredParts = (message.parts ?? []).filter((p: any, j: number) => {
          // In AI SDK 5, tool parts are checked via isToolUIPart and have state directly
          // Handle both new format and legacy format with toolInvocation
          if (isToolUIPart(p)) {
            if (p.state !== 'output-available' && p.state !== 'output-error') {
              return true;
            }
          } else if (p.type === 'tool-invocation' && p.toolInvocation?.state !== 'result') {
            return true;
          } else if (p.type !== 'tool-invocation' && !isToolUIPart(p)) {
            return true;
          }
          return j > this.partIndex;
        });
        const remainingMessage: LegacyUIMessage = {
          ...message,
          content: StreamingMessageParser.stripArtifacts(message.content ?? ''),
          parts: filteredParts as any,
        };
        fullMessages.push(remainingMessage);
      } else {
        fullMessages.push(message);
      }
    }
    return fullMessages;
  }

  shouldSendRelevantFiles(messages: LegacyUIMessage[], maxCollapsedMessagesSize: number): boolean {
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
        for (const part of message.parts ?? []) {
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

  private messagePartCutoff(messages: LegacyUIMessage[], maxCollapsedMessagesSize: number): [number, number] {
    let remaining = maxCollapsedMessagesSize;
    for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex--) {
      const message = messages[messageIndex];
      const parts = message.parts ?? [];
      for (let partIndex = parts.length - 1; partIndex >= 0; partIndex--) {
        const part = parts[partIndex] as any;
        // Handle both new AI SDK 5 format and legacy format
        if (isToolUIPart(part)) {
          if (part.state !== 'output-available' && part.state !== 'output-error') {
            continue;
          }
        } else if (part.type === 'tool-invocation' && part.toolInvocation?.state !== 'result') {
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

  private parsedAssistantMessage(message: LegacyUIMessage): ParsedAssistantMessage | null {
    if (message.role !== 'assistant') {
      return null;
    }
    const cached = this.assistantMessageCache.get(message);
    if (cached) {
      return cached;
    }

    const filesTouched = new Map<AbsolutePath, number>();
    for (const file of extractFileArtifacts(makePartId(message.id, 0), message.content ?? '')) {
      filesTouched.set(getAbsolutePath(file), 0);
    }
    const parts = message.parts ?? [];
    for (let j = 0; j < parts.length; j++) {
      const part = parts[j] as any;
      if (part.type === 'text') {
        const files = extractFileArtifacts(makePartId(message.id, j), part.text);
        for (const file of files) {
          filesTouched.set(getAbsolutePath(file), j);
        }
      }
      // Handle both new AI SDK 5 format (isToolUIPart) and legacy format (type === 'tool-invocation')
      const isViewTool = isToolUIPart(part)
        ? getToolName(part) === 'view' && part.state !== 'input-streaming'
        : part.type === 'tool-invocation' &&
          part.toolInvocation?.toolName === 'view' &&
          part.toolInvocation?.state !== 'partial-call';
      if (isViewTool) {
        const toolInput = isToolUIPart(part) ? part.input : part.toolInvocation?.args;
        const args = loggingSafeParse(viewParameters, toolInput);
        if (args.success) {
          filesTouched.set(getAbsolutePath(args.data.path), j);
        }
      }
      const isEditTool = isToolUIPart(part)
        ? getToolName(part) === 'edit' && part.state !== 'input-streaming'
        : part.type === 'tool-invocation' &&
          part.toolInvocation?.toolName === 'edit' &&
          part.toolInvocation?.state !== 'partial-call';
      if (isEditTool) {
        const toolInput = isToolUIPart(part) ? part.input : part.toolInvocation?.args;
        const args = loggingSafeParse(editToolParameters, toolInput);
        if (args.success) {
          filesTouched.set(getAbsolutePath(args.data.path), j);
        }
      }
    }
    const result = {
      filesTouched,
    };
    this.assistantMessageCache.set(message, result);
    return result;
  }

  private partSize(part: any) {
    const cached = this.partSizeCache.get(part);
    if (cached) {
      return cached;
    }
    let result = 0;
    // Handle AI SDK 5 tool parts first
    if (isToolUIPart(part)) {
      result += JSON.stringify(part.input ?? {}).length;
      if (part.state === 'output-available') {
        result += JSON.stringify(part.output ?? '').length;
      }
    } else {
      switch (part.type) {
        case 'text':
          result = part.text?.length ?? 0;
          break;
        case 'file':
          // AI SDK 5 file parts have url instead of data, mediaType instead of mimeType
          result += part.data?.length ?? part.url?.length ?? 0;
          result += part.mimeType?.length ?? part.mediaType?.length ?? 0;
          break;
        case 'reasoning':
          // AI SDK 5 reasoning parts use 'content' not 'reasoning'
          result += part.content?.length ?? part.reasoning?.length ?? 0;
          break;
        case 'tool-invocation':
          // Legacy format with toolInvocation property
          if (part.toolInvocation) {
            result += JSON.stringify(part.toolInvocation.args ?? {}).length;
            if (part.toolInvocation.state === 'result') {
              result += JSON.stringify(part.toolInvocation.result ?? '').length;
            }
          }
          break;
        case 'source':
          // Legacy source type
          result += (part.source?.title ?? '').length;
          result += (part.source?.url ?? '').length;
          break;
        case 'source-url':
        case 'source-document':
          // AI SDK 5 source types
          result += (part.title ?? '').length;
          result += (part.url ?? '').length;
          break;
        case 'step-start':
          break;
        default:
          // Don't throw for unknown types - just skip
          break;
      }
    }
    this.partSizeCache.set(part, result);
    return result;
  }
}

function makeUserMessage(content: string[], id: string): LegacyUIMessage {
  const parts: UIMessagePart[] = content.map((c) => ({
    type: 'text',
    // N.B. Do not change this title "Relevant Files" without also updating `extractUrlHintAndDescription`. It's super jank
    text: `<boltArtifact id="${id}" title="Relevant Files">
${c}
</boltArtifact>`,
  }));
  return {
    id,
    content: '',
    role: 'user',
    parts,
  } as LegacyUIMessage;
}

function estimateSize(entry: Dirent): number {
  if (entry.type === 'file') {
    return 4 + entry.content.length;
  } else {
    return 6;
  }
}

// In AI SDK 5, UIToolInvocation is the tool invocation type
// We accept any for backwards compatibility with stored data using legacy format
function abbreviateToolInvocation(toolInvocation: any): string {
  // Handle both legacy 'result' state and new 'output-available' state
  const isComplete = toolInvocation.state === 'result' || toolInvocation.state === 'output-available';
  if (!isComplete) {
    throw new Error(`Invalid tool invocation state: ${toolInvocation.state}`);
  }
  // Handle both legacy 'result' property and new 'output' property
  const result = toolInvocation.result ?? String(toolInvocation.output ?? '');
  const wasError = result.startsWith('Error:');
  let toolCall: string;
  switch (toolInvocation.toolName) {
    case 'view': {
      // Handle both legacy 'args' property and new 'input' property
      const args = loggingSafeParse(viewParameters, toolInvocation.args ?? toolInvocation.input);
      let verb = 'viewed';
      if (result.startsWith('Directory:')) {
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
      // Handle both legacy 'args' property and new 'input' property
      const args = loggingSafeParse(npmInstallToolParameters, toolInvocation.args ?? toolInvocation.input);
      if (args.success) {
        toolCall = `installed the dependencies ${args.data.packages}`;
      } else {
        toolCall = `attempted to install dependencies`;
      }
      break;
    }
    case 'edit': {
      // Handle both legacy 'args' property and new 'input' property
      const args = loggingSafeParse(editToolParameters, toolInvocation.args ?? toolInvocation.input);
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
      throw new Error(`Unknown tool name: ${toolInvocation.toolName}`);
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
