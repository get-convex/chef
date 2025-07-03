import { Button } from '@ui/Button';
import { PlusIcon } from '@radix-ui/react-icons';
import type { Id } from '@convex/_generated/dataModel';
import { useAreFilesSaving } from '~/lib/stores/fileUpdateCounter';

interface SubchatLimitNudgeProps {
  sessionId: Id<'sessions'> | null;
  chatId: string;
  messageCount: number;
  handleCreateSubchat: () => void;
}

export function SubchatLimitNudge({ sessionId, messageCount, handleCreateSubchat }: SubchatLimitNudgeProps) {
  const areFilesSaving = useAreFilesSaving();

  return (
    <div className="mx-auto w-full max-w-chat rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="font-medium text-orange-800 dark:text-orange-200">Create a new chat</h3>
            <p className="mt-1 text-sm text-orange-700 dark:text-orange-300">
              Your conversation has reached {messageCount} messages. For better performance, we recommend creating a new
              chat. This will preserve your current work, but provide you with a clean context.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            className="bg-orange-600 text-white hover:bg-orange-700"
            icon={<PlusIcon />}
            disabled={!sessionId || areFilesSaving}
            onClick={handleCreateSubchat}
          >
            Start New Chat
          </Button>
        </div>
      </div>
    </div>
  );
}
