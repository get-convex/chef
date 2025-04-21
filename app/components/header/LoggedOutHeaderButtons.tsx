import { FeedbackButton } from './FeedbackButton';
import { DiscordButton } from './DiscordButton';

export function LoggedOutHeaderButtons() {
  return (
    <>
      <FeedbackButton showInMenu={false} />
      <DiscordButton showInMenu={false} />
    </>
  );
}
