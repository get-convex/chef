import { useState, forwardRef } from 'react';
import { classNames } from '~/utils/classNames';
import { toast } from 'sonner';
import * as Popover from '@radix-ui/react-popover';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { waitForConvexSessionId } from '~/lib/stores/sessionId';
import { useChatId } from '~/lib/stores/chatId';

const Button = forwardRef<
  HTMLButtonElement,
  {
    active?: boolean;
    disabled?: boolean;
    children?: any;
    onClick?: VoidFunction;
    className?: string;
    title?: string;
  }
>(({ active = false, disabled = false, children, onClick, className, title }, ref) => {
  return (
    <button
      ref={ref}
      className={classNames(
        'flex items-center gap-1 p-1 text-sm border border-bolt-elements-borderColor rounded-md',
        {
          'bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary hover:text-bolt-elements-textPrimary':
            !active,
          'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': active && !disabled,
          'bg-bolt-elements-item-backgroundDefault text-alpha-gray-20 dark:text-alpha-white-20 cursor-not-allowed hover:bg-bolt-elements-item-backgroundDefault hover:text-bolt-elements-textTertiary':
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
});

type ShareStatus = 'idle' | 'loading' | 'success';

export function ShareButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<ShareStatus>('idle');
  const [shareUrl, setShareUrl] = useState('');
  const chatId = useChatId();

  const createShare = useMutation(api.share.create);

  const handleShare = async () => {
    try {
      setStatus('loading');

      const sessionId = await waitForConvexSessionId('ShareButton');

      const { code } = await createShare({
        id: chatId,
        sessionId,
      });

      const { origin } = window.location;
      const url = origin === 'https://chef.convex.dev' ? `https://chef.show/${code}` : `${origin}/share/${code}`;

      setShareUrl(url);
      setStatus('success');
    } catch (error) {
      toast.error('Failed to share. Please try again.');
      console.error('Share error:', error);
      setStatus('idle');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied to clipboard!');
  };

  // Reset status when popover closes
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setTimeout(() => {
        setStatus('idle');
      }, 200);
    }
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <Button active={isOpen}>
          <div className="i-ph:share-network w-4 h-4" />
          <span>Share</span>
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-50 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md shadow-lg w-[320px] animate-in fade-in-0 zoom-in-95"
          sideOffset={5}
          align="end"
        >
          <div className="p-4">
            <h2 className="text-base font-medium mb-4 text-bolt-elements-textPrimary">Share Project</h2>

            {status === 'idle' && (
              <>
                <p className="text-sm mb-4 text-bolt-elements-textSecondary">
                  This will create a shareable link to your code and chat history that anyone can access.
                </p>
                <div className="flex justify-end">
                  <button
                    className="px-3 py-1.5 bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent rounded-md text-sm"
                    onClick={handleShare}
                  >
                    Generate Link
                  </button>
                </div>
              </>
            )}

            {status === 'loading' && (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="i-ph:spinner-gap animate-spin w-8 h-8 mb-4 text-bolt-elements-textSecondary" />
                <p className="text-bolt-elements-textSecondary">Generating share link…</p>
              </div>
            )}

            {status === 'success' && (
              <>
                <p className="text-sm mb-4 text-bolt-elements-textSecondary">Use this link to share with others:</p>
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-3 py-1.5 rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary text-sm"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="p-1.5 bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary rounded-md border border-bolt-elements-borderColor"
                  >
                    <div className="i-ph:clipboard-text-duotone w-5 h-5" />
                  </button>
                </div>
              </>
            )}
          </div>

          <Popover.Arrow className="fill-bolt-elements-borderColor" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
