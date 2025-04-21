import { useStore } from '@nanostores/react';
import { ChatBubbleIcon, CodeIcon } from '@radix-ui/react-icons';
import { Button } from '@ui/Button';
import useViewport from '~/lib/hooks/useViewport';
import { chatStore } from '~/lib/stores/chatId';
import { workbenchStore } from '~/lib/stores/workbench.client';
import { classNames } from '~/utils/classNames';

interface HeaderActionButtonsProps {}

export function HeaderActionButtons({}: HeaderActionButtonsProps) {
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const { showChat } = useStore(chatStore);
  const isSmallViewport = useViewport(1024);
  const canHideChat = showWorkbench || !showChat;

  return (
    <div className="flex">
      <div className="flex overflow-hidden">
        <Button
          disabled={!canHideChat || isSmallViewport} // expand button is disabled on mobile as it's not needed
          tip={!canHideChat ? 'Cannot hide chat while code is closed' : showChat ? 'Hide chat' : 'Show chat'}
          onClick={() => {
            if (canHideChat) {
              chatStore.setKey('showChat', !showChat);
            }
          }}
          variant="neutral"
          className="border-r-0 rounded-r-none"
          icon={<ChatBubbleIcon className="my-px"/>}
        >
        </Button>
        <Button
          onClick={() => {
            if (showWorkbench && !showChat) {
              chatStore.setKey('showChat', true);
            }

            workbenchStore.showWorkbench.set(!showWorkbench);
          }}
          variant="neutral"
          className="rounded-l-none"
          icon={<CodeIcon className="my-px"/>}
          tip={showWorkbench ? 'Hide workbench' : 'Show workbench'}
        >
        </Button>
      </div>
    </div>
  );
}
