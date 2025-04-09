import { useStore } from '@nanostores/react';
import { useFileUpdateCounter } from '~/lib/stores/fileUpdateCounter';
import { workbenchStore } from '~/lib/stores/workbench';

export function SaveStatusIndicator() {
  const saveState = useStore(workbenchStore.backupState);
  const fileCounter = useFileUpdateCounter();

  if (!saveState.started) {
    return null;
  }
  let state: string;
  if (saveState.savedUpdateCounter !== fileCounter) {
    if (saveState.numFailures > 0) {
      state = 'error';
    } else {
      state = 'saving';
    }
  } else {
    state = 'saved';
  }
  return (
    <div className="flex items-center gap-1.5">
      {state === 'saved' && (
        <div className="flex items-center gap-1.5" style={{ color: 'var(--cvx-content-success)' }}>
          <div className="i-ph:check-circle text-lg" />
          <span className="text-sm">Saved</span>
        </div>
      )}
      {state === 'saving' && (
        <div className="flex items-center gap-1.5" style={{ color: 'var(--cvx-content-warning)' }}>
          <div className="i-ph:spinner-gap animate-spin text-lg" />
          <span className="text-sm">Saving...</span>
        </div>
      )}
      {state === 'error' && (
        <div className="flex items-center gap-1.5" style={{ color: 'var(--cvx-content-error)' }}>
          <div className="i-ph:warning-circle text-lg" />
          <span className="text-sm">Save failed</span>
        </div>
      )}
    </div>
  );
}
