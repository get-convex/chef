import { useState, forwardRef, useEffect } from 'react';
import { classNames } from '~/utils/classNames';
import { toast } from 'sonner';
import * as Popover from '@radix-ui/react-popover';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useConvexSessionId } from '~/lib/stores/sessionId';
import { useChatId } from '~/lib/stores/chatId';
import { Share2Icon, ClipboardIcon } from '@radix-ui/react-icons';
import { Spinner } from '@ui/Spinner';
import { Button } from '@ui/Button';


type ShareStatus = 'idle' | 'loading' | 'success';

export function ShareButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<ShareStatus>('idle');
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const chatId = useChatId();
  const sessionId = useConvexSessionId();
  const isShareReady = useQuery(api.share.isShareReady, shareCode ? { code: shareCode } : 'skip');

  const createShare = useMutation(api.share.create);

  const handleShare = async () => {
    try {
      setStatus('loading');

      const result = await createShare({
        id: chatId,
        sessionId,
      });

      if (result.code) {
        setShareCode(result.code);
      }
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

  useEffect(() => {
    if (status === 'loading' && isShareReady) {
      const { origin } = window.location;
      const url =
        origin === 'https://chef.convex.dev' ? `https://chef.show/${shareCode}` : `${origin}/share/${shareCode}`;

      setShareUrl(url);
      setStatus('success');
    }
  }, [shareCode, status, isShareReady]);

  return (
    <Popover.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <Button focused={isOpen} variant="neutral" size="xs">
          <Share2Icon />
          <span>Share Chat</span>
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-50 w-[320px] animate-fadeInFromLoading rounded-md border bg-bolt-elements-background-depth-1 shadow-lg"
          sideOffset={5}
          align="end"
        >
          <div className="p-4">
            <h2 className="mb-4 text-base font-medium text-content-primary">Share Project</h2>

            {status === 'idle' && (
              <>
                <p className="mb-4 text-sm text-content-secondary">
                  This will create a shareable link to your code and chat history that anyone can access.
                </p>
                <div className="flex justify-end">
                  <button
                    className="rounded-md bg-bolt-elements-item-backgroundAccent px-3 py-1.5 text-sm text-bolt-elements-item-contentAccent"
                    onClick={handleShare}
                  >
                    Generate Link
                  </button>
                </div>
              </>
            )}

            {status === 'loading' && (
              <div className="flex flex-col items-center justify-center py-6">
                <Spinner />
                <p className="text-content-secondary">Generating share link…</p>
              </div>
            )}

            {status === 'success' && (
              <>
                <p className="mb-4 text-sm text-content-secondary">Use this link to share with others:</p>
                <div className="mb-4 flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 rounded-md border bg-bolt-elements-background-depth-2 px-3 py-1.5 text-sm text-content-primary"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="rounded-md border bg-bolt-elements-item-backgroundDefault p-1.5 text-content-primary hover:bg-bolt-elements-item-backgroundActive"
                  >
                    <ClipboardIcon />
                  </button>
                </div>
              </>
            )}
          </div>

          <Popover.Arrow className="fill-border-transparent" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
