import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import * as Popover from '@radix-ui/react-popover';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useConvexSessionId } from '~/lib/stores/sessionId';
import { useChatId } from '~/lib/stores/chatId';
import {
  Share2Icon,
  ClipboardIcon,
  InfoCircledIcon,
  ImageIcon,
  ExternalLinkIcon,
  ChevronRightIcon,
} from '@radix-ui/react-icons';
import { Spinner } from '@ui/Spinner';
import { Button } from '@ui/Button';
import { Tooltip } from '@ui/Tooltip';
import { Checkbox } from '@ui/Checkbox';
import type { ChangeEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ThumbnailChooser } from '~/components/workbench/ThumbnailChooser';

type ShareStatus = 'idle' | 'loading' | 'success';
type SnapshotStatus = 'idle' | 'loading' | 'success';

export function ShareButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isThumbnailModalOpen, setIsThumbnailModalOpen] = useState(false);
  const [snapshotStatus, setSnapshotStatus] = useState<SnapshotStatus>('idle');
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');
  const [snapshotCode, setSnapshotCode] = useState<string | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState('');
  const [shareUrl, setShareUrl] = useState('');

  // Form state
  const [isSharedDraft, setIsSharedDraft] = useState(false);

  // This button is always visible so these are generally available by the time
  // the user clicks the button.
  const chatId = useChatId();
  const sessionId = useConvexSessionId();

  // private shared project info
  const currentShare = useQuery(api.socialShare.getCurrentSocialShare, {
    id: chatId,
    sessionId,
  });

  // public shared project info
  const shareDetails = useQuery(
    api.socialShare.getSocialShare,
    currentShare?.code ? { code: currentShare.code } : 'skip',
  );

  const isSnapshotReady = useQuery(api.share.isShareReady, snapshotCode ? { code: snapshotCode } : 'skip');

  const createShare = useMutation(api.share.create);
  const socialShare = useMutation(api.socialShare.share);

  // Update form state when currentShare changes
  useEffect(() => {
    if (currentShare) {
      setIsSharedDraft(currentShare.shared);

      // Set up share URL if we have a code
      if (currentShare.code) {
        const { origin } = window.location;
        const url =
          origin === 'https://chef.convex.dev'
            ? `https://chef.show/${currentShare.code}`
            : `${origin}/share/${currentShare.code}`;
        setShareUrl(url);
      }
    }
  }, [currentShare]);

  const handleCreateSnapshot = async () => {
    try {
      setSnapshotStatus('loading');

      const result = await createShare({
        id: chatId,
        sessionId,
      });

      if (result.code) {
        setSnapshotCode(result.code);
      }
    } catch (error) {
      toast.error('Failed to create snapshot. Please try again.');
      console.error('Snapshot error:', error);
      setSnapshotStatus('idle');
    }
  };

  const handleShare = async (change?: { shared?: boolean }) => {
    try {
      setShareStatus('loading');

      await socialShare({
        sessionId,
        id: chatId,
        shared: change?.shared !== undefined ? change.shared : isSharedDraft,
        allowForkFromLatest: true,
      });

      setShareStatus('success');
      toast.success('Sharing settings saved');
    } catch (error) {
      toast.error('Failed to update share settings. Please try again.');
      console.error('Share error:', error);
      setShareStatus('idle');
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
  };

  // Reset status when popover closes
  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);
    if (open && !currentShare) {
      // Auto-share on first open, when there is no share record yet.
      setShareStatus('loading');
      await handleShare({ shared: true });
    }
    if (!open) {
      // on close, clear any draft state
      setIsSharedDraft(!!currentShare?.shared);
      setSnapshotStatus('idle');
      setShareStatus('idle');
    }
  };

  useEffect(() => {
    if (snapshotStatus === 'loading' && isSnapshotReady) {
      const { origin } = window.location;
      const url = `${origin}/create/${snapshotCode}`;

      setSnapshotUrl(url);
      setSnapshotStatus('success');
    }
  }, [snapshotCode, snapshotStatus, isSnapshotReady]);

  const hasChanges = currentShare && currentShare.shared !== isSharedDraft;

  return (
    <>
      <Popover.Root open={isOpen} onOpenChange={handleOpenChange}>
        <Popover.Trigger asChild>
          <Button focused={isOpen} variant="neutral" size="xs">
            <Share2Icon />
            <span>Share</span>
          </Button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className="z-50 w-[400px] animate-fadeInFromLoading rounded-md border bg-bolt-elements-background-depth-1 shadow-lg"
            sideOffset={5}
            align="end"
          >
            <div className="flex flex-col gap-6 p-4">
              <div>
                {currentShare && currentShare.shared && (
                  <>
                    {/* Share URL */}
                    <div className="mb-4">
                      <p className="mb-2 text-sm text-content-secondary">Share URL:</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={shareUrl}
                          className="flex-1 rounded-md border bg-bolt-elements-background-depth-2 px-3 py-1.5 text-sm text-content-primary"
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(shareUrl)}
                          className="rounded-md border bg-bolt-elements-item-backgroundDefault p-1.5 text-content-primary hover:bg-bolt-elements-item-backgroundActive"
                        >
                          <ClipboardIcon />
                        </button>
                        <a
                          href={shareUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border bg-bolt-elements-item-backgroundDefault p-1.5 text-content-primary hover:bg-bolt-elements-item-backgroundActive"
                        >
                          <ExternalLinkIcon />
                        </a>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-4">
                  <label className="group flex cursor-pointer items-start gap-2">
                    <Checkbox
                      id="isShared"
                      checked={isSharedDraft}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setIsSharedDraft(e.target.checked)}
                    />
                    <div className="space-y-1">
                      <span className="block text-sm font-medium group-hover:text-content-primary">Share project</span>
                      <p className="text-xs text-content-secondary group-hover:text-content-secondary/80">
                        Make this project visible to anyone with the link
                      </p>
                    </div>
                  </label>

                  <div>TODO: Show thumbnail/screenshot. {snapshotUrl}</div>

                  <div className="flex justify-between">
                    <Button variant="neutral" size="xs" onClick={() => setIsThumbnailModalOpen(true)}>
                      <ImageIcon />
                      <span>Set Thumbnail</span>
                    </Button>

                    <Button
                      variant="neutral"
                      onClick={() => handleShare()}
                      disabled={shareStatus === 'loading' || !hasChanges}
                    >
                      {shareStatus === 'loading' ? (
                        <>
                          <Spinner className="size-4" />
                          <span>Saving...</span>
                        </>
                      ) : hasChanges ? (
                        'Save sharing settings'
                      ) : (
                        'Saved'
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                {/* Deployed URL if available */}
                {shareDetails?.hasBeenDeployed && shareDetails.deployedUrl && (
                  <div className="mb-4">
                    <p className="mb-2 text-sm text-content-secondary">Deployed app URL:</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareDetails.deployedUrl}
                        className="flex-1 rounded-md border bg-bolt-elements-background-depth-2 px-3 py-1.5 text-sm text-content-primary"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(shareDetails.deployedUrl!)}
                        className="rounded-md border bg-bolt-elements-item-backgroundDefault p-1.5 text-content-primary hover:bg-bolt-elements-item-backgroundActive"
                      >
                        <ClipboardIcon />
                      </button>
                      <a
                        href={shareDetails.deployedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border bg-bolt-elements-item-backgroundDefault p-1.5 text-content-primary hover:bg-bolt-elements-item-backgroundActive"
                      >
                        <ExternalLinkIcon />
                      </a>
                    </div>
                  </div>
                )}
                <details className="group">
                  <summary className="flex cursor-pointer select-none items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" />
                      <span className="text-sm text-content-secondary group-hover:text-content-primary">
                        Advanced options
                      </span>
                    </div>
                  </summary>

                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-end gap-2">
                      <Tooltip tip="Create a link to a specific version of your project that others can clone, including all chat history but without database contents. This can be useful for support tickets.">
                        <InfoCircledIcon className="size-4" />
                      </Tooltip>
                      <Button variant="neutral" onClick={handleCreateSnapshot}>
                        Create Point-In-Time Snapshot
                      </Button>
                    </div>

                    {snapshotStatus === 'loading' && (
                      <div className="flex flex-col items-center justify-center py-4">
                        <Spinner />
                        <p className="text-sm text-content-secondary">Creating snapshot…</p>
                      </div>
                    )}

                    {snapshotStatus === 'success' && snapshotUrl && (
                      <div className="space-y-2">
                        <p className="text-sm text-content-secondary">Snapshot link:</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={snapshotUrl}
                            className="flex-1 rounded-md border bg-bolt-elements-background-depth-2 px-3 py-1.5 text-sm text-content-primary"
                          />
                          <button
                            onClick={() => copyToClipboard(snapshotUrl)}
                            className="rounded-md border bg-bolt-elements-item-backgroundDefault p-1.5 text-content-primary hover:bg-bolt-elements-item-backgroundActive"
                          >
                            <ClipboardIcon />
                          </button>
                          <a
                            href={snapshotUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md border bg-bolt-elements-item-backgroundDefault p-1.5 text-content-primary hover:bg-bolt-elements-item-backgroundActive"
                          >
                            <ExternalLinkIcon />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            </div>

            <Popover.Arrow className="fill-border-transparent" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <Dialog.Root open={isThumbnailModalOpen} onOpenChange={setIsThumbnailModalOpen}>
        <ThumbnailChooser isOpen={isThumbnailModalOpen} onOpenChange={setIsThumbnailModalOpen} />
      </Dialog.Root>
    </>
  );
}
