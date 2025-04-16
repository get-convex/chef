import { memo } from 'react';
import { classNames } from '~/utils/classNames';

interface PanelHeaderProps {
  className?: string;
  children: React.ReactNode;
}

export const PanelHeader = memo(function PanelHeader({ className, children }: PanelHeaderProps) {
  return (
    <div
      className={classNames(
        'flex items-center gap-2 bg-bolt-elements-background-depth-2 text-content-secondary border-b px-4 py-1 min-h-[34px] text-sm',
        className,
      )}
    >
      {children}
    </div>
  );
});
