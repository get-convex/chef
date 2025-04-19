import * as Sentry from '@sentry/remix';
import { ChatBubbleIcon } from '@radix-ui/react-icons';
import { OverflowMenuButton } from './OverflowMenuButton';

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
    <OverflowMenuButton onClick={handleFeedback}>
      <ChatBubbleIcon />
      <span>Submit Feedback</span>
    </OverflowMenuButton>
  );
}
