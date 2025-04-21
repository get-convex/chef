import * as Sentry from '@sentry/remix';
import { ChatBubbleIcon } from '@radix-ui/react-icons';
import { MenuItem } from '@ui/Menu';
import { Button } from '@ui/Button';

export function FeedbackButton({ showInMenu }: { showInMenu: boolean }) {
  const handleFeedback = async () => {
    const feedback = Sentry.getFeedback();
    const form = await feedback?.createForm();
    if (form) {
      form.appendToDom();
      form.open();
    }
  };

  if (showInMenu) {
    return (
      <MenuItem action={handleFeedback}>
        <ChatBubbleIcon />
        <span>Submit Feedback</span>
      </MenuItem>
    );
  }

  return (
    <Button variant="neutral" size="xs" onClick={handleFeedback} icon={<ChatBubbleIcon />}>
      Submit Feedback
    </Button>
  );
}
