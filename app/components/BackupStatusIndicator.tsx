import { useStore } from '@nanostores/react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useFileUpdateCounter } from '~/lib/stores/fileUpdateCounter';
import { workbenchStore } from '~/lib/stores/workbench.client';

type ToastState = { type: 'idle'; lastCompleted: number } | { type: 'loading'; toastId: string };

const TOAST_DURATION = 1000;
const TOAST_COOLDOWN = 5000;

export function BackupStatusIndicator() {
  const toastState = useRef<ToastState>({ type: 'idle', lastCompleted: 0 });
  const backupState = useStore(workbenchStore.backupState);
  const fileCounter = useFileUpdateCounter();
  useEffect(() => {
    if (!backupState.started) {
      return;
    }
    if (backupState.savedUpdateCounter === fileCounter) {
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
          const toastId = crypto.randomUUID();
          toast.loading('Saving...', {
            id: toastId,
          });
          toastState.current = { type: 'loading', toastId };
        }
      }
    }
  }, [backupState, fileCounter]);

  return null;
}
