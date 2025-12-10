import type { UIMessage } from 'ai';

/**
 * AI SDK 5 Message Compatibility Layer
 *
 * In AI SDK 5:
 * - `Message` type is now `UIMessage`
 * - `UIMessage` uses `parts` array instead of `content` string
 * - `UIMessage` does not have `annotations` directly (handled via data parts or metadata)
 * - Tool invocations are now part of the `parts` array with type `tool-${toolName}`
 * - Tool part properties are directly on the part (toolCallId, toolName, state, input, output)
 *   instead of nested under `toolInvocation`
 *
 * For backwards compatibility with stored data in Convex, we maintain support for:
 * - Reading old format with `content` string and `annotations`
 * - The serialized format stores both old and new properties
 */

/**
 * Extended UIMessage type that includes legacy properties for backwards compatibility
 * with stored data in Convex.
 */
export interface LegacyCompatibleMessage extends UIMessage {
  // Legacy properties that may exist in stored data
  content?: string;
  annotations?: unknown[];
  toolInvocations?: unknown[];
  createdAt?: Date;
}

/**
 * Extract text content from a UIMessage's parts array.
 * In AI SDK 5, UIMessage uses `parts` array instead of `content` string.
 */
export function getTextFromParts(message: UIMessage): string {
  if (!message.parts) {
    return '';
  }
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

/**
 * Get message content, handling both new parts-based format and legacy content string.
 */
export function getMessageContent(message: UIMessage | LegacyCompatibleMessage): string {
  const legacyMessage = message as LegacyCompatibleMessage;
  // Try parts first (new format)
  if (message.parts && message.parts.length > 0) {
    return getTextFromParts(message);
  }
  // Fall back to legacy content string
  if (legacyMessage.content) {
    return legacyMessage.content;
  }
  return '';
}

/**
 * Create a user message in the new UIMessage format.
 */
export function createUserMessage(id: string, text: string): UIMessage {
  return {
    id,
    role: 'user',
    parts: [{ type: 'text', text }],
  };
}

/**
 * Get annotations from a message, handling the fact that UIMessage
 * no longer has annotations directly in AI SDK 5.
 */
export function getMessageAnnotations(message: UIMessage): unknown[] {
  const legacyMessage = message as LegacyCompatibleMessage;
  return legacyMessage.annotations ?? [];
}
