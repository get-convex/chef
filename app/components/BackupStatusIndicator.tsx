import { useStore } from '@nanostores/react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useFileUpdateCounter } from '~/lib/stores/fileUpdateCounter';
import { chatSyncState } from '~/lib/stores/startup/chatSyncState';

type ToastState = { type: 'idle'; lastCompleted: number } | { type: 'loading'; toastId: string };

const TOAST_DURATION = 1000;
const TOAST_COOLDOWN = 5000;

export function BackupStatusIndicator() {
  const toastState = useRef<ToastState>({ type: 'idle', lastCompleted: 0 });
  const backupState = useStore(chatSyncState);
  const fileCounter = useFileUpdateCounter();
  useEffect(() => {
    if (backupState.savedFileUpdateCounter === null) {
      return;
    }
    if (backupState.savedFileUpdateCounter === fileCounter) {
      if (toastState.current.type === 'loading') {
        toast.success('Files saved!', {
          id: toastState.current.toastId,
          duration: TOAST_DURATION,
        });
        toastState.current = { type: 'idle', lastCompleted: Date.now() };
      }
    } else {
      if (toastState.current.type === 'idle') {
        const now = Date.now();
        if (toastState.current.lastCompleted + TOAST_COOLDOWN < now) {
          // Only show "Saving..." toast if "chat-save-failure" toast is not currently showing
          const activeToasts = toast.getHistory();
          const chatSaveFailureToastActive = activeToasts.some((t) => t.id === 'chat-save-failure');

          if (!chatSaveFailureToastActive) {
            const toastId = crypto.randomUUID();
            toast.loading('Saving...', {
              id: toastId,
            });
            toastState.current = { type: 'loading', toastId };
          }
        }
      }
    }
  }, [backupState, fileCounter]);

  return null;
}
