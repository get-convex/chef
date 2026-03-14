/**
 * Phase detection logic for Chef's AI builder
 * Detects the current development phase based on tool calls and file patterns
 */

import type { Message } from 'ai';
import type { Phase, PhaseDetectionResult } from '~/lib/common/phases';
import { parsePhase } from '~/lib/common/phases';

interface ToolCall {
  toolName: string;
  result?: string;
  state?: string;
}

/**
 * Extract file paths from artifact actions in a message
 */
function extractFilesFromMessage(message: Message): string[] {
  const files: string[] = [];

  // Check for artifacts in message parts
  if (message.parts) {
    for (const part of message.parts) {
      if (part.type === 'tool-invocation' && part.toolInvocation) {
        const invocation = part.toolInvocation;

        // Extract files from edit tool calls
        if (invocation.toolName === 'edit' && invocation.args) {
          const args = invocation.args as { file_path?: string };
          if (args.file_path) {
            files.push(args.file_path);
          }
        }
      }
    }
  }

  // Check for boltArtifact tags in message content
  const artifactRegex = /<boltAction[^>]*filePath="([^"]+)"/g;
  let match;
  while ((match = artifactRegex.exec(message.content)) !== null) {
    files.push(match[1]);
  }

  return files;
}

/**
 * Detect the current phase based on message content, tool calls, and file patterns
 */
export function detectPhase(
  currentPhase: Phase | null,
  messages: Message[],
  toolCalls: ToolCall[],
): PhaseDetectionResult {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) {
    return { phase: 'planning', confidence: 'low' };
  }

  const messageContent = lastMessage.content || '';
  const filesInArtifact = extractFilesFromMessage(lastMessage);

  // 1. Explicit phase announcement in message (highest confidence)
  if (messageContent.includes('Phase')) {
    const phaseMatch = messageContent.match(/Phase (\w+(?:-\w+)*) complete/i);
    if (phaseMatch) {
      const detectedPhase = parsePhase(phaseMatch[1]);
      if (detectedPhase) {
        return { phase: detectedPhase, confidence: 'high' };
      }
    }
  }

  // 2. Tool-based detection
  const hasSchemaFiles = filesInArtifact.some((f) => f.includes('convex/schema.ts'));
  const hasFunctionFiles = filesInArtifact.some((f) => f.match(/convex\/.*(?<!schema)\.ts$/));
  const hasFrontendFiles = filesInArtifact.some((f) => f.includes('src/'));
  const hasPackageJson = filesInArtifact.some((f) => f === 'package.json' || f.endsWith('package.json'));
  const hasConvexConfig = filesInArtifact.some((f) => f.includes('convex.config.ts'));

  // 3. Review phase: after deploy failures (highest priority)
  const recentDeployFailures = toolCalls.filter(
    (t) => t.toolName === 'deploy' && t.result && t.result.startsWith('Error:'),
  );
  if (recentDeployFailures.length > 0 && currentPhase !== 'review') {
    return { phase: 'review', confidence: 'high' };
  }

  // Exit review phase on successful deploy
  const hasSuccessfulDeploy = toolCalls.some(
    (t) => t.toolName === 'deploy' && t.state === 'result' && t.result && !t.result.startsWith('Error:'),
  );
  if (currentPhase === 'review' && hasSuccessfulDeploy) {
    // Return to previous phase or integration
    return { phase: 'integration', confidence: 'medium' };
  }

  // 4. Foundation phase: setting up initial files
  if ((hasPackageJson || hasConvexConfig) && (!currentPhase || currentPhase === 'planning')) {
    return { phase: 'foundation', confidence: 'high' };
  }

  // 5. Backend Schema phase: working on schema
  if (hasSchemaFiles && !hasFunctionFiles && filesInArtifact.length <= 3) {
    return { phase: 'backend-schema', confidence: 'high' };
  }

  // 6. Backend Functions phase: writing queries/mutations
  if (hasFunctionFiles && !hasFrontendFiles) {
    return { phase: 'backend-functions', confidence: 'medium' };
  }

  // 7. Frontend Components phase: building UI
  if (hasFrontendFiles && !hasFunctionFiles) {
    return { phase: 'frontend-components', confidence: 'medium' };
  }

  // 8. Integration phase: working on both frontend and backend
  if (hasFrontendFiles && hasFunctionFiles) {
    return { phase: 'integration', confidence: 'medium' };
  }

  // 9. Integration phase: multiple successful deploys suggest integration work
  const successfulDeploys = toolCalls.filter(
    (t) => t.toolName === 'deploy' && t.state === 'result' && t.result && !t.result.startsWith('Error:'),
  );
  if (successfulDeploys.length >= 2 && currentPhase === 'frontend-components') {
    return { phase: 'integration', confidence: 'medium' };
  }

  // 10. Default: stay in current phase or start planning
  if (currentPhase) {
    return { phase: currentPhase, confidence: 'low' };
  }

  return { phase: 'planning', confidence: 'low' };
}

/**
 * Determine if we should write a phase annotation based on detection result
 */
export function shouldUpdatePhase(
  currentPhase: Phase | null,
  detection: PhaseDetectionResult,
): boolean {
  // Only update on high confidence or medium confidence with phase change
  if (detection.confidence === 'high') {
    return detection.phase !== currentPhase;
  }

  if (detection.confidence === 'medium') {
    return detection.phase !== currentPhase;
  }

  return false;
}
