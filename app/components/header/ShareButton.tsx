import { useState, useEffect, useCallback } from 'react';
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
import { ThumbnailChooser, uploadThumbnail } from '~/components/workbench/ThumbnailChooser';
import { workbenchStore } from '~/lib/stores/workbench.client';
import { captureException } from '@sentry/remix';
import { useReferralCode, useReferralStats } from '~/lib/hooks/useReferralCode';
import { selectedTeamSlugStore } from '~/lib/stores/convexTeams';
import { useStore } from '@nanostores/react';

type ShareStatus = 'idle' | 'loading' | 'success';
type SnapshotStatus = 'idle' | 'loading' | 'success';

export function ShareButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isThumbnailModalOpen, setIsThumbnailModalOpen] = useState(false);
  const [snapshotStatus, setSnapshotStatus] = useState<SnapshotStatus>('idle');
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');
  const [snapshotUrl, setSnapshotUrl] = useState('');
  const [shareUrl, setShareUrl] = useState('');

  // Don't allow sharing until a preview is ready so we can get a decent screenshot.
  const previews = useStore(workbenchStore.previews);
  const anyPreviewReady = previews.some((preview) => preview.ready);

  // Form state
  const [isSharedDraft, setIsSharedDraft] = useState(false);

  // This button is always visible so these are generally available by the time
  // the user clicks the button.
  const chatId = useChatId();
  const sessionId = useConvexSessionId();
  const referralCode = useReferralCode();
  const referralStats = useReferralStats();
  const teamSlug = useStore(selectedTeamSlugStore);

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

  const createShare = useMutation(api.share.create);
  const socialShare = useMutation(api.socialShare.share);

  // Update form state when currentShare changes
  useEffect(() => {
    if (currentShare) {
      setIsSharedDraft(currentShare.shared === 'shared');

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
      const { origin } = window.location;
      const url = `${origin}/create/${result.code}`;
      setSnapshotUrl(url);
      setSnapshotStatus('success');
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
        shared: (change?.shared !== undefined ? change.shared : isSharedDraft) ? 'shared' : 'expresslyUnshared',
        allowForkFromLatest: true,
        referralCode,
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
    if (open && (!currentShare || !currentShare?.thumbnailImageStorageId)) {
      // Try to grab a screenshot each time the share menu is opened if there isn't one.
      try {
        const screenshot = await workbenchStore.requestAnyScreenshot(3000);
        if (screenshot) {
          await uploadThumbnail(screenshot, sessionId, chatId);
        }
      } catch (error) {
        // This will happen a lot at first: old projects don't response to screenshot requests.
        console.error('Error uploading thumbnail:', error);
        captureException(error);
      }
    }
    if (!open) {
      // on close, clear any draft state
      setIsSharedDraft(currentShare ? currentShare.shared === 'shared' : false);
      setSnapshotStatus('idle');
      setShareStatus('idle');
    }
  };

  const hasChanges = currentShare && (currentShare.shared === 'shared') !== isSharedDraft;

  const handleRequestCapture = useCallback(() => {
    return workbenchStore.requestAnyScreenshot();
  }, []);

  return (
    <>
      <Popover.Root open={isOpen} onOpenChange={handleOpenChange}>
        <Popover.Trigger asChild>
          <Button disabled={!anyPreviewReady} focused={isOpen} variant="neutral" size="xs">
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
            <div className="flex flex-col gap-4 p-4">
              <div>
                <div className="space-y-4">
                  <label className="group flex cursor-pointer items-start gap-2">
                    <Checkbox
                      id="isShared"
                      checked={isSharedDraft}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setIsSharedDraft(e.target.checked)}
                    />
                    <span className="block text-sm font-medium group-hover:text-content-primary">Share project</span>
                  </label>

                  {/* Share link input and buttons, no label, right below checkbox */}
                  {currentShare && currentShare.shared === 'shared' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        className="flex-1 rounded-md border bg-bolt-elements-background-depth-2 px-3 py-1.5 text-sm text-content-primary"
                      />
                      <Button
                        variant="neutral"
                        size="xs"
                        onClick={() => copyToClipboard(shareUrl)}
                        tip="Copy link"
                        icon={<ClipboardIcon />}
                      />
                      <Button
                        variant="neutral"
                        size="xs"
                        onClick={() => window.open(shareUrl, '_blank', 'noopener,noreferrer')}
                        tip="Open in new tab"
                        icon={<ExternalLinkIcon />}
                      />
                    </div>
                  )}

                  {currentShare?.shared === 'shared' && (
                    <div className="group flex items-start gap-2">
                      <div className="space-y-1">
                        {referralStats?.left !== 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-content-secondary group-hover:text-content-secondary/80">
                              Links on this page include your referral code: signups will grant you 85,000 free Chef
                              tokens each
                              {referralStats?.left === 5 || !referralStats
                                ? ' (limit 5)'
                                : ` (${referralStats.left} / 5)`}
                            </p>
                            <a
                              href={`https://dashboard.convex.dev/t/${teamSlug}/settings/referrals`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:text-blue-600"
                            >
                              Show referrals in the Convex dashboard
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button variant="neutral" size="xs" onClick={() => setIsThumbnailModalOpen(true)}>
                        {shareDetails?.thumbnailUrl ? (
                          <div className="relative size-4 overflow-hidden rounded shadow-[0_2px_4px_rgba(0,0,0,0.4)] ring-1 ring-black/10">
                            <img
                              src={shareDetails.thumbnailUrl}
                              alt="Share thumbnail"
                              className="absolute inset-0 size-full object-cover"
                              crossOrigin="anonymous"
                            />
                          </div>
                        ) : (
                          <ImageIcon />
                        )}
                        <span>Set Thumbnail</span>
                      </Button>
                    </div>

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
                <details className="group">
                  <summary className="flex cursor-pointer select-none items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" />
                      <span className="text-sm text-content-secondary group-hover:text-content-primary">
                        More ways to share
                      </span>
                    </div>
                  </summary>
                  {/* Deployed URL if available */}
                  {shareDetails?.hasBeenDeployed && shareDetails.deployedUrl && (
                    <div className="my-4">
                      <p className="mb-2 text-sm text-content-secondary">Deployed app link:</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={shareDetails.deployedUrl}
                          className="flex-1 rounded-md border bg-bolt-elements-background-depth-2 px-3 py-1.5 text-sm text-content-primary"
                        />
                        <Button
                          variant="neutral"
                          size="xs"
                          onClick={() => copyToClipboard(shareDetails.deployedUrl!)}
                          tip="Copy link"
                          icon={<ClipboardIcon />}
                        />
                        <Button
                          variant="neutral"
                          size="xs"
                          onClick={() => {
                            const url = shareDetails.deployedUrl;
                            if (typeof url === 'string') {
                              window.open(url, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          tip="Open in new tab"
                          icon={<ExternalLinkIcon />}
                        />
                      </div>
                    </div>
                  )}
                  <div className="mt-4 space-y-4">
                    {/* Direct Referral Link first */}
                    {referralCode && (
                      <div className="space-y-2">
                        <p className="text-sm text-content-secondary">Direct Referral Link:</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={`https://convex.dev/try-chef/${referralCode}`}
                            className="flex-1 rounded-md border bg-bolt-elements-background-depth-2 px-3 py-1.5 text-sm text-content-primary"
                          />
                          <Button
                            variant="neutral"
                            size="xs"
                            onClick={() => copyToClipboard(`https://convex.dev/try-chef/${referralCode}`)}
                            tip="Copy link"
                            icon={<ClipboardIcon />}
                          />
                        </div>
                      </div>
                    )}

                    {/* Then the snapshot button */}
                    <div className="flex items-center justify-start gap-2">
                      <Button variant="neutral" onClick={handleCreateSnapshot}>
                        Create Point-In-Time Snapshot
                      </Button>
                      <Tooltip tip="Create a link to a specific version of your project that others can clone, including all chat history but without database contents. This can be useful for support tickets.">
                        <InfoCircledIcon className="size-4" />
                      </Tooltip>
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
                          <Button
                            variant="neutral"
                            size="xs"
                            onClick={() => copyToClipboard(snapshotUrl)}
                            tip="Copy link"
                            icon={<ClipboardIcon />}
                          />
                          <Button
                            variant="neutral"
                            size="xs"
                            onClick={() => window.open(snapshotUrl, '_blank', 'noopener,noreferrer')}
                            tip="Open in new tab"
                            icon={<ExternalLinkIcon />}
                          />
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
        <ThumbnailChooser
          isOpen={isThumbnailModalOpen}
          onOpenChange={setIsThumbnailModalOpen}
          onRequestCapture={handleRequestCapture}
        />
      </Dialog.Root>
    </>
  );
}
