import { classNames } from '~/utils/classNames';

interface OverflowMenuButtonProps {
  active?: boolean;
  disabled?: boolean;
  children?: any;
  onClick?: VoidFunction;
  className?: string;
  title?: string;
}

export function OverflowMenuButton({
  active = false,
  disabled = false,
  children,
  onClick,
  className,
  title,
}: OverflowMenuButtonProps) {
  return (
    <button
      className={classNames(
        'flex items-center gap-1 p-1 text-sm w-full',
        {
          'text-content-primary hover:text-content-primary': !active,
          'text-bolt-elements-item-contentAccent': active && !disabled,
          'text-gray-900/20 dark:text-white/20 cursor-not-allowed': disabled,
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
