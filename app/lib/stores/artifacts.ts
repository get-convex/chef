import type { MapStore } from 'nanostores';
import type { ArtifactState } from './workbench.client';
import { makePartId, type PartId } from 'chef-agent/partId.js';
export { makePartId, type PartId };

export type Artifacts = MapStore<Record<PartId, ArtifactState>>;
