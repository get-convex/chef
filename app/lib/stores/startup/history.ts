import type { Message } from 'ai';
import { useConvex, type ConvexReactClient } from 'convex/react';
import { atom } from 'nanostores';
import { waitForConvexSessionId } from '~/lib/stores/sessionId';
import { getFileUpdateCounter, waitForFileUpdateCounterChanged } from '~/lib/stores/fileUpdateCounter';
import { buildUncompressedSnapshot } from '~/lib/snapshot.client';
import type { Id } from '@convex/_generated/dataModel';
import { backoffTime } from '~/utils/constants';
import { useEffect } from 'react';
import { compressWithLz4 } from '~/lib/compression';
import {
  handleUrlHintAndDescription,
  lastCompleteMessageInfoStore,
  prepareMessageHistory,
  waitForNewMessages,
} from './messages';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('history');

const BACKUP_DEBOUNCE_MS = 1000;

export const chatSyncState = atom<BackupSyncState>({
  lastSync: 0,
  numFailures: 0,
  started: false,
  persistedMessageInfo: null,
  savedFileUpdateCounter: null,
});

type BackupSyncState = {
  lastSync: number;
  numFailures: number;
  started: boolean;
  persistedMessageInfo: { messageIndex: number; partIndex: number } | null;
  savedFileUpdateCounter: number | null;
};

type InitialBackupSyncState = {
  lastSync: number;
  numFailures: number;
  started: boolean;
  persistedMessageInfo: { messageIndex: number; partIndex: number };
  savedFileUpdateCounter: number;
};

export function useBackupSyncState(chatId: string, initialMessages?: Message[]) {
  const convex = useConvex();
  useEffect(() => {
    if (initialMessages !== undefined) {
      const lastMessage = initialMessages[initialMessages.length - 1];
      const lastMessagePartIndex = (lastMessage?.parts?.length ?? 0) - 1;
      const currentSyncState = chatSyncState.get();
      if (currentSyncState.persistedMessageInfo === null) {
        chatSyncState.set({
          ...currentSyncState,
          persistedMessageInfo: {
            messageIndex: initialMessages.length - 1,
            partIndex: lastMessagePartIndex,
          },
        });
        lastCompleteMessageInfoStore.set({
          messageIndex: initialMessages.length - 1,
          partIndex: lastMessagePartIndex,
          allMessages: initialMessages,
          hasNextPart: false,
        });
      }
    }
  }, [initialMessages]);
  useEffect(() => {
    const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      const currentState = chatSyncState.get();
      const completeMessageInfo = lastCompleteMessageInfoStore.get();
      const fileUpdateCounter = getFileUpdateCounter();
      const isChatHistoryDirty =
        currentState.persistedMessageInfo !== null &&
        completeMessageInfo !== null &&
        (currentState.persistedMessageInfo.messageIndex !== completeMessageInfo.messageIndex ||
          currentState.persistedMessageInfo.partIndex !== completeMessageInfo.partIndex ||
          completeMessageInfo.hasNextPart);
      const isFileUpdateCounterDirty =
        currentState.savedFileUpdateCounter !== null && currentState.savedFileUpdateCounter !== fileUpdateCounter;
      if (isChatHistoryDirty || isFileUpdateCounterDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
      return undefined;
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);
    return () => {
      window.removeEventListener('beforeunload', beforeUnloadHandler);
    };
  }, []);
  useEffect(() => {
    const run = async () => {
      const sessionId = await waitForConvexSessionId('useBackupSyncState');
      void chatSyncWorker({ chatId, sessionId, convex });
    };
    void run();
  }, [chatId, convex]);
}

/**
 * This worker handles syncing both the chat history + the snapshot of the filesystem
 * state to the server.
 *
 * It holds the state of what it's synced so far in `chatSyncState` and listens for
 * changes to `lastCompleteMessageInfoStore` and `fileUpdateCounter` respectively
 * to know when to sync.
 */
async function chatSyncWorker(args: { chatId: string; sessionId: Id<'sessions'>; convex: ConvexReactClient }) {
  const { chatId, sessionId, convex } = args;
  const currentState = chatSyncState.get();
  if (currentState.started) {
    return;
  }
  chatSyncState.set({
    ...currentState,
    started: true,
  });
  while (true) {
    const currentState = await waitForInitialized();
    const completeMessageInfo = lastCompleteMessageInfoStore.get();
    if (completeMessageInfo === null) {
      logger.error('Complete message info not initialized');
      continue;
    }
    const areMessagesUpToDate =
      completeMessageInfo.partIndex === currentState.persistedMessageInfo.partIndex &&
      completeMessageInfo.messageIndex === currentState.persistedMessageInfo.messageIndex;

    if (areMessagesUpToDate) {
      // if between messages, wait for either a file system change or a new message part to start
      if (!completeMessageInfo.hasNextPart) {
        const fileUpdatePromise = waitForFileUpdateCounterChanged(currentState.savedFileUpdateCounter);
        const newMessagesPromise = waitForNewMessages(
          currentState.persistedMessageInfo.messageIndex,
          currentState.persistedMessageInfo.partIndex,
          /* alertOnNextPartStart */ true,
        );
        await Promise.race([fileUpdatePromise, newMessagesPromise]);
      } else {
        // if the next part has started, ignore file system changes but listen for the next part
        // to complete
        const newMessagesPromise = waitForNewMessages(
          currentState.persistedMessageInfo.messageIndex,
          currentState.persistedMessageInfo.partIndex,
          /* alertOnNextPartStart */ false,
        );
        await newMessagesPromise;
      }
    }

    const nextSync = currentState.lastSync + BACKUP_DEBOUNCE_MS;
    const now = Date.now();
    if (now < nextSync) {
      await new Promise((resolve) => setTimeout(resolve, nextSync - now));
    }
    let messageBlob: Uint8Array | undefined = undefined;
    let urlHintAndDescription: { urlHint: string; description: string } | null = null;
    let newPersistedMessageInfo: { messageIndex: number; partIndex: number } | null = null;

    const messageHistoryResult = await prepareMessageHistory({
      chatId,
      sessionId,
      completeMessageInfo,
      persistedMessageInfo: currentState.persistedMessageInfo,
    });
    const { url, update } = messageHistoryResult;
    if (update !== null) {
      messageBlob = update.compressed;
      urlHintAndDescription = update.urlHintAndDescription ?? null;
      newPersistedMessageInfo = { messageIndex: update.messageIndex, partIndex: update.partIndex };
    }

    let snapshotBlob: Uint8Array | undefined = undefined;
    const nextSavedUpdateCounter = getFileUpdateCounter();
    if (currentState.savedFileUpdateCounter !== nextSavedUpdateCounter) {
      snapshotBlob = await prepareBackup();
    }
    if (urlHintAndDescription !== null) {
      await handleUrlHintAndDescription(
        convex,
        chatId,
        sessionId,
        urlHintAndDescription.urlHint,
        urlHintAndDescription.description,
      );
    }
    if (messageBlob === undefined && snapshotBlob === undefined) {
      logger.info('Complete message info not initialized');
      continue;
    }
    let response;
    let error: Error | null = null;
    const formData = new FormData();
    if (messageBlob !== undefined) {
      formData.append('messages', new Blob([messageBlob]));
    }
    if (snapshotBlob !== undefined) {
      formData.append('snapshot', new Blob([snapshotBlob]));
    }
    try {
      response = await fetch(url, {
        method: 'POST',
        body: formData,
      });
    } catch (e) {
      error = e as Error;
    }
    if (error !== null || (response !== undefined && !response.ok)) {
      const errorText = response !== undefined ? await response.text() : (error?.message ?? 'Unknown error');
      logger.error('Complete message info not initialized');
      chatSyncState.set({
        ...currentState,
        numFailures: currentState.numFailures + 1,
      });
      const sleepTime = backoffTime(currentState.numFailures);
      logger.error(
        `Failed to save chat (num failures: ${currentState.numFailures}), sleeping for ${sleepTime.toFixed(2)}ms`,
        errorText,
      );
      await new Promise((resolve) => setTimeout(resolve, sleepTime));
      continue;
    }
    const updates: Partial<BackupSyncState> = {
      lastSync: now,
      numFailures: 0,
      savedFileUpdateCounter: nextSavedUpdateCounter,
    };
    if (newPersistedMessageInfo !== null) {
      updates.persistedMessageInfo = newPersistedMessageInfo;
    }
    chatSyncState.set({
      ...currentState,
      ...updates,
    });
  }
}

async function waitForInitialized(): Promise<InitialBackupSyncState> {
  const state = chatSyncState.get();
  if (state.persistedMessageInfo !== null && state.savedFileUpdateCounter !== null) {
    return {
      ...state,
      persistedMessageInfo: state.persistedMessageInfo!,
      savedFileUpdateCounter: state.savedFileUpdateCounter!,
    };
  }
  return new Promise<InitialBackupSyncState>((resolve) => {
    let unlisten: (() => void) | null = null;
    unlisten = chatSyncState.listen((state) => {
      if (state.persistedMessageInfo !== null && state.savedFileUpdateCounter !== null) {
        if (unlisten !== null) {
          unlisten();
          unlisten = null;
        }
        resolve({
          ...state,
          persistedMessageInfo: state.persistedMessageInfo!,
          savedFileUpdateCounter: state.savedFileUpdateCounter!,
        });
      }
    });
  });
}

async function prepareBackup() {
  const binarySnapshot = await buildUncompressedSnapshot();
  const compressed = await compressWithLz4(binarySnapshot);
  return compressed;
}
