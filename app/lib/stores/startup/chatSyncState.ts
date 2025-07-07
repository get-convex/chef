import { atom } from 'nanostores';

export const chatSyncState = atom<BackupSyncState>({
  lastSync: 0,
  numFailures: 0,
  started: false,
  persistedMessageInfo: null,
  savedFileUpdateCounter: null,
  subchatIndex: 0,
});

export type BackupSyncState = {
  lastSync: number;
  numFailures: number;
  started: boolean;
  persistedMessageInfo: { messageIndex: number; partIndex: number } | null;
  savedFileUpdateCounter: number | null;
  subchatIndex: number;
};

export type InitialBackupSyncState = {
  lastSync: number;
  numFailures: number;
  started: boolean;
  persistedMessageInfo: { messageIndex: number; partIndex: number };
  savedFileUpdateCounter: number;
  subchatIndex: number;
};
