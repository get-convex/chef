/**
 * Phase tracking types and utilities for Chef's AI builder
 */

export const PHASES = [
  'planning',
  'foundation',
  'backend-schema',
  'backend-functions',
  'frontend-components',
  'integration',
  'review',
] as const;

export type Phase = (typeof PHASES)[number];

export type PhaseStatus = 'started' | 'completed';

export interface PhaseHistory {
  phase: Phase;
  startedAt: number;
  completedAt?: number;
}

export interface PhaseDetectionResult {
  phase: Phase;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Get a human-readable display name for a phase
 */
export function getPhaseDisplayName(phase: Phase): string {
  return phase.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/**
 * Parse a phase string into a Phase type, or return null if invalid
 */
export function parsePhase(phaseStr: string): Phase | null {
  const normalized = phaseStr.toLowerCase().replace(/\s+/g, '-');
  return PHASES.includes(normalized as Phase) ? (normalized as Phase) : null;
}

/**
 * Determine if a phase transition is valid
 */
export function isValidPhaseTransition(from: Phase | null, to: Phase): boolean {
  // Can always enter review from anywhere
  if (to === 'review') {
    return true;
  }

  // If no current phase, can only go to planning or foundation
  if (!from) {
    return to === 'planning' || to === 'foundation';
  }

  // Can always return to planning
  if (to === 'planning') {
    return true;
  }

  // Generally phases should progress forward
  const fromIndex = PHASES.indexOf(from);
  const toIndex = PHASES.indexOf(to);

  // Allow moving forward or staying in same phase
  return toIndex >= fromIndex;
}
