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
