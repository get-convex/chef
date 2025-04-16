import * as Sentry from '@sentry/remix';
import { classNames } from '~/utils/classNames';
import { ChatBubbleIcon } from '@radix-ui/react-icons';

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

export function FeedbackButton() {
  const handleFeedback = async () => {
    const feedback = Sentry.getFeedback();
    const form = await feedback?.createForm();
    if (form) {
      form.appendToDom();
      form.open();
    }
  };

  return (
    <Button onClick={handleFeedback}>
      <ChatBubbleIcon />
      <span>Submit Feedback</span>
    </Button>
  );
}
