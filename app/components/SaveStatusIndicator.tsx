import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';

export function SaveStatusIndicator() {
  const saveState = useStore(workbenchStore.saveState);

  return (
    <div className="flex items-center gap-1.5">
      {saveState === 'saved' && (
        <div className="flex items-center gap-1.5" style={{ color: 'var(--cvx-content-success)' }}>
          <div className="i-ph:check-circle text-lg" />
          <span className="text-sm">Saved</span>
        </div>
      )}
      {saveState === 'saving' && (
        <div className="flex items-center gap-1.5" style={{ color: 'var(--cvx-content-warning)' }}>
          <div className="i-ph:spinner-gap animate-spin text-lg" />
          <span className="text-sm">Saving...</span>
        </div>
      )}
      {saveState === 'error' && (
        <div className="flex items-center gap-1.5" style={{ color: 'var(--cvx-content-error)' }}>
          <div className="i-ph:warning-circle text-lg" />
          <span className="text-sm">Save failed</span>
        </div>
      )}
    </div>
  );
}
