import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import { Dialog, DialogRoot } from '~/components/ui/Dialog';
import { toast } from 'sonner';
import { convexStore } from '~/lib/stores/convex';

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
}

type ShareStatus = 'idle' | 'loading' | 'success';

export function ShareButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<ShareStatus>('idle');
  const [shareUrl, setShareUrl] = useState('');
  const convex = useStore(convexStore);

  const handleShare = async () => {
    try {
      setStatus('loading');

      // Simulate sharing process with a delay
      // In a real implementation, you would make an API call to generate the share link
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Create a share URL based on the current deployment
      const url = convex
        ? `https://${convex.deploymentName}.convex.app/shared/${Date.now()}`
        : `${window.location.origin}/shared/${Date.now()}`;

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

  const closeDialog = () => {
    setIsOpen(false);
    // Reset status after dialog closes
    setTimeout(() => {
      if (!isOpen) {
        setStatus('idle');
      }
    }, 300);
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <div className="i-ph:share-network w-4 h-4" />
        <span>Share</span>
      </Button>

      <DialogRoot open={isOpen} onOpenChange={setIsOpen}>
        <Dialog className="w-[420px] p-5" onClose={closeDialog}>
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold mb-4 text-bolt-elements-textPrimary">Share Project</h2>

            {status === 'idle' && (
              <>
                <p className="text-sm mb-4 text-bolt-elements-textSecondary">
                  This will create a shareable link to your project that anyone can access. The link will remain active
                  until you delete it.
                </p>
                <div className="flex justify-end">
                  <button
                    className="px-4 py-2 bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent rounded-md"
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
                <p className="text-bolt-elements-textSecondary">Generating share link...</p>
              </div>
            )}

            {status === 'success' && (
              <>
                <p className="text-sm mb-4 text-bolt-elements-textSecondary">
                  Your project is now shared! Use this link to share with others:
                </p>
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-3 py-2 rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="px-3 py-2 bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary rounded-md border border-bolt-elements-borderColor"
                  >
                    <div className="i-ph:clipboard-text-duotone w-5 h-5" />
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    className="px-4 py-2 text-bolt-elements-textPrimary bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive rounded-md border border-bolt-elements-borderColor"
                    onClick={closeDialog}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </Dialog>
      </DialogRoot>
    </>
  );
}
