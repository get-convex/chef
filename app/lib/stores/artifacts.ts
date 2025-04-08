import type { MapStore } from 'nanostores';
import type { ArtifactState } from './workbench';

export type PartId = `${string}-${number}`;
export type Artifacts = MapStore<Record<PartId, ArtifactState>>;

export function makePartId(messageId: string, index: number): PartId {
  return `${messageId}-${index}`;
}
