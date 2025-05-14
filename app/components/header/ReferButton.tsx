import { Button } from '@ui/Button';
import { toast } from 'sonner';
import { useReferralCode, useReferralStats } from '~/lib/hooks/useReferralCode';
import * as Popover from '@radix-ui/react-popover';
import { ClipboardIcon } from '@radix-ui/react-icons';
import { useState } from 'react';

export function ReferButton() {
  const referralCode = useReferralCode();
  const referralStats = useReferralStats();
  const [isOpen, setIsOpen] = useState(false);

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
  };

  // Calculate referrals used
  const used = typeof referralStats?.left === 'number' ? 5 - referralStats.left : 0;

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <Button variant="neutral" size="xs" className="px-2">
          <span>Refer to get tokens {used}/5</span>
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-[400px] animate-fadeInFromLoading rounded-md border bg-bolt-elements-background-depth-1 shadow-lg"
          sideOffset={5}
          align="end"
        >
          <div className="flex flex-col gap-4 p-4">
            {referralCode && (
              <div className="space-y-2">
                <p className="text-sm text-content-secondary">
                  Refer a friend to Chef to earn more tokens. <br />
                  Each referral gets you 85,000 more tokens.
                </p>
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
                <p className="text-xs text-content-secondary">
                  {typeof referralStats?.left === 'number' ? `Referrals used: ${used} / 5` : 'Referrals used: 0 / 5'}
                </p>
              </div>
            )}
          </div>
          <Popover.Arrow className="fill-border-transparent" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
