import * as Sentry from '@sentry/remix';
import { ChatBubbleIcon } from '@radix-ui/react-icons';
import { MenuItem } from '@ui/Menu';

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
    <MenuItem action={handleFeedback} >
      <ChatBubbleIcon />
      <span>Submit Feedback</span>
    </MenuItem>
  );
}
