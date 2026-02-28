import type { UIMessage } from 'ai';
import { useConvex, useQuery, type ConvexReactClient } from 'convex/react';
import { useConvexSessionIdOrNullOrLoading, waitForConvexSessionId } from '~/lib/stores/sessionId';
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
import { createScopedLogger } from 'chef-agent/utils/logger';
import { useStore } from '@nanostores/react';
import { subchatIndexStore, waitForSubchatIndexChanged } from '~/lib/stores/subchats';
import { api } from '@convex/_generated/api';
import { workbenchStore } from '~/lib/stores/workbench.client';
import { chatSyncState, type BackupSyncState, type InitialBackupSyncState } from './chatSyncState';
import { toast } from 'sonner';

const logger = createScopedLogger('history');

const BACKUP_DEBOUNCE_MS = 1000;

export function useBackupSyncState(chatId: string, loadedSubchatIndex?: number, initialMessages?: UIMessage[]) {
  const convex = useConvex();
  const subchatIndex = useStore(subchatIndexStore);
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const chatInfo = useQuery(
    api.messages.get,
    sessionId
      ? {
          id: chatId,
          sessionId,
        }
      : 'skip',
  );
  useEffect(() => {
    if (initialMessages !== undefined) {
      const lastMessage = initialMessages[initialMessages.length - 1];
      const lastMessagePartIndex = (lastMessage?.parts?.length ?? 0) - 1;
      const currentSyncState = chatSyncState.get();
      // Update the persistedMessageInfo when initialMessages is null or the subchat index changes
      if (
        loadedSubchatIndex !== undefined &&
        (currentSyncState.persistedMessageInfo === null || loadedSubchatIndex !== currentSyncState.subchatIndex)
      ) {
        chatSyncState.set({
          ...currentSyncState,
          persistedMessageInfo: {
            messageIndex: initialMessages.length - 1,
            partIndex: lastMessagePartIndex,
          },
          subchatIndex: loadedSubchatIndex,
        });
        lastCompleteMessageInfoStore.set({
          messageIndex: initialMessages.length - 1,
          partIndex: lastMessagePartIndex,
          allMessages: initialMessages,
          hasNextPart: false,
        });
      }
    }
  }, [initialMessages, loadedSubchatIndex]);
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
      // Open the workbench by default if you have more than one subchat
      if (chatInfo && chatInfo.subchatIndex > 0) {
        workbenchStore.showWorkbench.set(true);
      }
      void chatSyncWorker({
        chatId,
        sessionId,
        convex,
        currentSubchatIndex: subchatIndex,
        latestSubchatIndex: chatInfo?.subchatIndex,
      });
    };
    void run();
  }, [chatId, convex, subchatIndex, chatInfo]);
}

/**
 * This worker handles syncing both the chat history + the snapshot of the filesystem
 * state to the server.
 *
 * It holds the state of what it's synced so far in `chatSyncState` and listens for
 * changes to `lastCompleteMessageInfoStore` and `fileUpdateCounter` respectively
 * to know when to sync.
 */
async function chatSyncWorker(args: {
  chatId: string;
  sessionId: Id<'sessions'>;
  convex: ConvexReactClient;
  currentSubchatIndex: number | undefined;
  latestSubchatIndex: number | undefined;
}) {
  const { chatId, sessionId, convex } = args;
  const currentState = chatSyncState.get();
  if (currentState.started) {
    return;
  }
  if (args.currentSubchatIndex === undefined || args.latestSubchatIndex === undefined) {
    return;
  }
  // We only need to sync if we're on the latest subchat. Otherwise, we shouldn't be sending
  // updates to the server.
  if (args.currentSubchatIndex !== args.latestSubchatIndex) {
    return;
  }
  chatSyncState.set({
    ...currentState,
    started: true,
    subchatIndex: args.currentSubchatIndex,
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
        const subchatIndexPromise = waitForSubchatIndexChanged(currentState.subchatIndex);
        await Promise.race([fileUpdatePromise, newMessagesPromise, subchatIndexPromise]);
      } else {
        // if the next part has started, ignore file system changes but listen for the next part
        // to complete
        const newMessagesPromise = waitForNewMessages(
          currentState.persistedMessageInfo.messageIndex,
          currentState.persistedMessageInfo.partIndex,
          /* alertOnNextPartStart */ false,
        );
        const subchatIndexPromise = waitForSubchatIndexChanged(currentState.subchatIndex);
        await Promise.race([newMessagesPromise, subchatIndexPromise]);
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
    let firstMessage: string | undefined = undefined;

    const messageHistoryResult = await prepareMessageHistory({
      chatId,
      sessionId,
      completeMessageInfo,
      persistedMessageInfo: currentState.persistedMessageInfo,
      subchatIndex: currentState.subchatIndex,
    });
    const { url, update } = messageHistoryResult;
    if (update !== null) {
      messageBlob = update.compressed;
      urlHintAndDescription = update.urlHintAndDescription ?? null;
      newPersistedMessageInfo = { messageIndex: update.messageIndex, partIndex: update.partIndex };
      firstMessage = update.firstMessage;
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
    if (firstMessage !== undefined) {
      formData.append('firstMessage', firstMessage);
    }
    if (currentState.subchatIndex !== subchatIndexStore.get()) {
      chatSyncState.set({
        ...currentState,
        persistedMessageInfo: null,
      });
      continue;
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
      const newFailureCount = currentState.numFailures + 1;
      chatSyncState.set({
        ...currentState,
        numFailures: newFailureCount,
      });

      // Show toast notification after 3 consecutive failures
      if (newFailureCount >= 3) {
        toast.error('Your chat is having trouble saving and progress may be lost. Download your code to save it.', {
          id: 'chat-save-failure',
          duration: Number.POSITIVE_INFINITY,
        });
      }

      const sleepTime = backoffTime(newFailureCount);
      logger.error(
        `Failed to save chat (num failures: ${newFailureCount}), sleeping for ${sleepTime.toFixed(2)}ms`,
        errorText,
      );
      await new Promise((resolve) => setTimeout(resolve, sleepTime));
      continue;
    }
    // Dismiss the save failure toast on successful save
    if (currentState.numFailures >= 3) {
      toast.dismiss('chat-save-failure');
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
  if (
    state.persistedMessageInfo !== null &&
    state.savedFileUpdateCounter !== null &&
    state.subchatIndex === subchatIndexStore.get()
  ) {
    return {
      ...state,
      persistedMessageInfo: state.persistedMessageInfo!,
      savedFileUpdateCounter: state.savedFileUpdateCounter!,
    };
  }
  return new Promise<InitialBackupSyncState>((resolve) => {
    let unlisten: (() => void) | null = null;
    unlisten = chatSyncState.listen((state) => {
      if (
        state.persistedMessageInfo !== null &&
        state.savedFileUpdateCounter !== null &&
        state.subchatIndex === subchatIndexStore.get()
      ) {
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
