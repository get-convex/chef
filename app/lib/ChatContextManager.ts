import { generateId, type ToolInvocation, type UIMessage } from 'ai';
import { renderFile } from '~/utils/fileUtils';
import type { Dirent } from './stores/files';
import { PREWARM_PATHS, WORK_DIR } from '~/utils/constants';
import { workbenchStore } from './stores/workbench';
import { StreamingMessageParser } from './runtime/message-parser';
import { path } from '~/utils/path';
import { editorToolParameters } from './runtime/editorTool';
import { bashToolParameters } from './runtime/bashTool';
// import { bashToolParameters, editorToolParameters } from "./tools";

// It's wasteful to actually tokenize the content, so we'll just use character
// counts as a heuristic.
const MAX_RELEVANT_FILES_SIZE = 8192;
const MAX_RELEVANT_FILES = 16;

const MAX_COLLAPSED_MESSAGES_SIZE = 4096;

type UIMessagePart = UIMessage['parts'][number];

type ParsedAssistantMessage = {
  filesTouched: Map<string, number>;
};

export class ChatContextManager {
  assistantMessageCache: WeakMap<UIMessage, ParsedAssistantMessage> = new WeakMap();
  messageSizeCache: WeakMap<UIMessage, number> = new WeakMap();
  partSizeCache: WeakMap<UIMessagePart, number> = new WeakMap();

  /**
   * Our request context has a few sections:
   *
   * 1. The Convex guidelines, which are filled in by the server and
   *    set to be cached by Anthropic (~10k tokens).
   * 2. Some relevant project files, which are filled in from the file
   *    cache based on LRU (at most ~5k tokens).
   * 3. A potentially collapsed segment of the chat history followed
   *    by the full fidelity recent chat history (~5k tokens).
   */
  prepareContext(messages: UIMessage[]): UIMessage[] {
    const relevantFiles = this.relevantFiles(messages);
    const collapsedMessages = this.collapseMessages(messages);
    return [...relevantFiles, ...collapsedMessages];
  }

  private relevantFiles(messages: UIMessage[]): UIMessage[] {
    const currentDocument = workbenchStore.currentDocument.get();

    // Seed the set with the PREWARM_PATHS.
    const cache = workbenchStore.files.get();
    const allPaths = Object.keys(cache).toSorted();

    const lastUsed: Map<string, number> = new Map();
    for (const path of PREWARM_PATHS) {
      const entry = cache[path];
      if (!entry) {
        console.log('Missing prewarm entry', path);
        continue;
      }
      lastUsed.set(path, 0);
    }

    // Iterate over the messages and update the last used time for each path.
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
      partCounter += message.parts.length;
    }

    for (const [path, lastUsedTime] of workbenchStore.userWrites.entries()) {
      const existing = lastUsed.get(path) ?? 0;
      lastUsed.set(path, Math.max(existing, lastUsedTime));
    }

    // If there's a currently open document, remove it from the relevance list
    // since we'll unconditionally include it later.
    if (currentDocument) {
      lastUsed.delete(currentDocument.filePath);
    }

    const sortedByLastUsed = Array.from(lastUsed.entries()).sort((a, b) => b[1] - a[1]);
    let sizeEstimate = 0;
    const relevantFiles: UIMessage[] = [];

    if (sortedByLastUsed.length > 0) {
      relevantFiles.push(
        makeSystemMessage(`Here are all the paths in the project:\n${allPaths.map((p) => ` - ${p}`).join('\n')}`),
      );
    }
    const debugInfo: string[] = [];
    if (sortedByLastUsed.length > 0) {
      relevantFiles.push(makeSystemMessage('Here are some relevant files in the project.'));
      for (const [path] of sortedByLastUsed) {
        if (sizeEstimate > MAX_RELEVANT_FILES_SIZE) {
          break;
        }
        if (relevantFiles.length >= MAX_RELEVANT_FILES) {
          break;
        }
        const entry = cache[path];
        if (!entry) {
          continue;
        }
        if (entry.type === 'file') {
          const content = renderFile(entry.content);
          relevantFiles.push(makeSystemMessage(`"${path}":\n${content}`));
          const size = estimateSize(entry);
          sizeEstimate += size;
          debugInfo.push(`  "${path}": ${size}`);
        }
      }
    }

    if (currentDocument) {
      let message = `The user currently has an editor open at ${currentDocument.filePath}. Here are the contents:\n`;
      message += renderFile(currentDocument.value);
      relevantFiles.push(makeSystemMessage(message));
    }

    console.log(
      `Populated ${relevantFiles.length} relevant files with size ${sizeEstimate}:\n${debugInfo.join('\n')}`,
      allPaths,
      relevantFiles,
    );
    return relevantFiles;
  }

  private collapseMessages(messages: UIMessage[]): UIMessage[] {
    const before = messages
      .flatMap((m) => m.parts)
      .map((p) => this.partSize(p))
      .reduce((a, b) => a + b, 0);
    const [iCutoff, jCutoff] = this.messagePartCutoff(messages);
    const summaryLines = [];
    const fullMessages = [];
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      if (i < iCutoff) {
        for (const part of message.parts) {
          const summary = summarizePart(message, part);
          if (summary) {
            summaryLines.push(summary);
          }
        }
      } else if (i === iCutoff) {
        const filteredParts = message.parts.filter((p, j) => {
          if (p.type !== 'tool-invocation' || p.toolInvocation.state !== 'result') {
            return true;
          }
          return j > jCutoff;
        });
        for (let j = 0; j < filteredParts.length; j++) {
          const part = filteredParts[j];
          if (part.type === 'tool-invocation' && part.toolInvocation.state === 'result' && j <= jCutoff) {
            const summary = summarizePart(message, part);
            if (summary) {
              summaryLines.push(summary);
            }
          }
        }
        const remainingMessage = {
          ...message,
          content: StreamingMessageParser.stripArtifacts(message.content),
          parts: filteredParts,
        };
        fullMessages.push(remainingMessage);
      } else {
        fullMessages.push(message);
      }
    }
    const result: UIMessage[] = [];
    if (summaryLines.length > 0) {
      result.push(makeSystemMessage(`Conversation summary:\n${summaryLines.join('\n')}`));
    }
    result.push(...fullMessages);
    const after = result
      .flatMap((m) => m.parts)
      .map((p) => this.partSize(p))
      .reduce((a, b) => a + b, 0);
    console.log(`Collapsed ${before} -> ${after} bytes in message history`, messages, result);
    return result;
  }

  private messagePartCutoff(messages: UIMessage[]): [number, number] {
    let remaining = MAX_COLLAPSED_MESSAGES_SIZE;
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      for (let j = message.parts.length - 1; j >= 0; j--) {
        const part = message.parts[j];
        if (part.type === 'tool-invocation' && part.toolInvocation.state !== 'result') {
          continue;
        }
        const size = this.partSize(part);
        if (size > remaining) {
          return [i, j];
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

    const filesTouched = new Map<string, number>();
    for (const file of extractFileArtifacts(message.id, message.content)) {
      filesTouched.set(file, 0);
    }
    for (let j = 0; j < message.parts.length; j++) {
      const part = message.parts[j];
      if (part.type === 'text') {
        const files = extractFileArtifacts(message.id, part.text);
        for (const file of files) {
          filesTouched.set(file, j);
        }
      }
      if (
        part.type == 'tool-invocation' &&
        part.toolInvocation.toolName == 'str_replace_editor' &&
        part.toolInvocation.state !== 'partial-call'
      ) {
        const args = editorToolParameters.parse(part.toolInvocation.args);
        filesTouched.set(args.path, j);
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
        result += part.data.length;
        result += part.mimeType.length;
        break;
      case 'reasoning':
        result += part.reasoning.length;
        break;
      case 'tool-invocation':
        result += JSON.stringify(part.toolInvocation.args).length;
        if (part.toolInvocation.state === 'result') {
          result += JSON.stringify(part.toolInvocation.result).length;
        }
        break;
      case 'source':
        result += (part.source.title ?? '').length;
        result += part.source.url.length;
        break;
      case 'step-start':
        break;
      default:
        throw new Error(`Unknown part type: ${JSON.stringify(part)}`);
    }
    this.partSizeCache.set(part, result);
    return result;
  }
}

function summarizePart(message: UIMessage, part: UIMessagePart): string | null {
  if (part.type === 'text') {
    return `${message.role}: ${StreamingMessageParser.stripArtifacts(part.text)}`;
  }
  if (part.type === 'tool-invocation' && part.toolInvocation.state === 'result') {
    return abbreviateToolInvocation(part.toolInvocation);
  }
  return null;
}

function makeSystemMessage(content: string): UIMessage {
  return {
    id: generateId(),
    content,
    role: 'system',
    parts: [
      {
        type: 'text',
        text: content,
      },
    ],
  };
}

function estimateSize(entry: Dirent): number {
  if (entry.type === 'file') {
    return 4 + entry.content.length;
  } else {
    return 6;
  }
}

function abbreviateToolInvocation(toolInvocation: ToolInvocation): string {
  if (toolInvocation.state !== 'result') {
    throw new Error(`Invalid tool invocation state: ${toolInvocation.state}`);
  }
  const wasError = toolInvocation.result.startsWith('Error:');
  let toolCall: string;
  switch (toolInvocation.toolName) {
    case 'str_replace_editor': {
      const args = editorToolParameters.parse(toolInvocation.args);
      switch (args.command) {
        case 'create':
          toolCall = `created ${args.path}`;
          break;
        case 'view':
          toolCall = `viewed ${args.path}`;
          break;
        case 'str_replace':
        case 'insert':
          toolCall = `edited ${args.path}`;
          break;
        case 'undo_edit':
          toolCall = `undid an edit to ${args.path}`;
          break;
        default:
          throw new Error(`Unknown command: ${args.command}`);
      }
      break;
    }
    case 'bash': {
      const args = bashToolParameters.parse(toolInvocation.args);
      toolCall = `ran the command ${args.command}`;
      break;
    }
    default:
      throw new Error(`Unknown tool name: ${toolInvocation.toolName}`);
  }
  return `Tool call: The assistant ${toolCall} ${wasError ? 'and got an error' : 'successfully'}.`;
}

function extractFileArtifacts(id: string, content: string) {
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
  parser.parse(id, content);
  return Array.from(filesTouched);
}
