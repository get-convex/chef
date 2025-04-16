import { classNames } from '~/utils/classNames';
import { DownloadIcon } from '@radix-ui/react-icons';
import { convexProjectStore } from '~/lib/stores/convexProject';
import { workbenchStore } from '~/lib/stores/workbench.client';

interface ButtonProps {
  active?: boolean;
  disabled?: boolean;
  children?: any;
  onClick?: VoidFunction;
  className?: string;
  title?: string;
}

function Button({ active = false, disabled = false, children, onClick, className, title }: ButtonProps) {
  return (
    <button
      className={classNames(
        'flex items-center gap-1 p-1 text-sm border border-bolt-elements-borderColor rounded-md',
        {
          'bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-content-primary hover:text-content-primary':
            !active,
          'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': active && !disabled,
          'bg-bolt-elements-item-backgroundDefault text-gray-900/20 dark:text-white/20 cursor-not-allowed hover:bg-bolt-elements-item-backgroundDefault hover:text-content-tertiary':
            disabled,
        },
        className,
      )}
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

export function DownloadButton() {
  const handleDownload = async () => {
    const convexProject = convexProjectStore.get();
    workbenchStore.downloadZip({
      convexProject: convexProject ?? null,
    });
  };

  return (
    <Button onClick={handleDownload}>
      <DownloadIcon />
      <span>Download Code</span>
    </Button>
  );
}
