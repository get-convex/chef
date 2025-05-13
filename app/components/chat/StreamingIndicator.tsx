import { AnimatePresence, motion } from 'framer-motion';
import type { ToolStatus } from '~/lib/common/types';
import { toast } from 'sonner';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chatId';
import { Spinner } from '@ui/Spinner';
import { ExclamationTriangleIcon, CheckCircledIcon, ResetIcon, ClipboardIcon } from '@radix-ui/react-icons';
import { useEffect, useState } from 'react';
import { Button } from '@ui/Button';
import { useUsage } from '~/lib/stores/usage';
import { Donut } from '@ui/Donut';
import { Loading } from '@ui/Loading';
import { useSelectedTeamSlug } from '~/lib/stores/convexTeams';
import { useEntitlements, useReferralCode, useReferralStats } from '~/lib/hooks/useReferralCode';
import { Popover } from '@ui/Popover';

type StreamStatus = 'streaming' | 'submitted' | 'ready' | 'error';

interface StreamingIndicatorProps {
  streamStatus: StreamStatus;
  numMessages: number;
  toolStatus?: ToolStatus;
  currentError?: Error;
  resendMessage: () => void;
}

// Icon components
const WarningIcon = () => <ExclamationTriangleIcon className="text-[var(--cvx-content-warning)]" />;
const LoadingIcon = () => <Spinner />;
const CheckIcon = () => <CheckCircledIcon />;

// Status messages
export const STATUS_MESSAGES = {
  cooking: 'Cooking...',
  stopped: 'Generation stopped',
  error: 'The model hit an error. Try sending your message again.',
  generated: 'Response Generated',
} as const;

const COOKING_SPLINES_MESSAGES = [
  'Simmering stock... ',
  'Practicing mise-en-place...',
  'Adjusting seasoning...',
  'Adding a pinch of salt...',
  'Reducing sauce...',
  'Whisking vigorously...',
  'Deglazing pan...',
  'Letting the flavors mingle...',
  'Browning butter...',
  'Preheating oven...',
  'Caramelizing onions...',
  'Chiffonading herbs...',
  'Massaging kale...',
  'Adding a splash of flavor...',
  'Julienning carrots...',
];
const COOKING_SPLINES_PROBABILITY = 0.2;
const COOKING_SPLINES_DURATION = 4000;

export default function StreamingIndicator(props: StreamingIndicatorProps) {
  const { aborted } = useStore(chatStore);
  const teamSlug = useSelectedTeamSlug();

  let streamStatus = props.streamStatus;
  const anyToolRunning =
    props.toolStatus && Object.values(props.toolStatus).some((status) => status === 'running' || status === 'pending');
  if (anyToolRunning) {
    streamStatus = 'streaming';
  }

  const [cookingMessage, setCookingMessage] = useState<string | null>(null);
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (streamStatus === 'submitted' || streamStatus === 'streaming') {
      timer = setInterval(() => {
        let newMessage = null;
        if (Math.random() < COOKING_SPLINES_PROBABILITY) {
          const randomIndex = Math.floor(Math.random() * COOKING_SPLINES_MESSAGES.length);
          newMessage = COOKING_SPLINES_MESSAGES[randomIndex];
        }
        setCookingMessage(newMessage);
      }, COOKING_SPLINES_DURATION);
    } else {
      setCookingMessage(null);
    }
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [streamStatus]);

  if (streamStatus === 'ready' && props.numMessages === 0) {
    return null;
  }

  let icon: React.ReactNode;
  let message: React.ReactNode;

  if (aborted) {
    icon = <WarningIcon />;
    message = STATUS_MESSAGES.stopped;
  } else {
    switch (streamStatus) {
      case 'submitted':
      case 'streaming':
        icon = <LoadingIcon />;
        message = cookingMessage || STATUS_MESSAGES.cooking;
        break;
      case 'error':
        icon = <WarningIcon />;
        message = STATUS_MESSAGES.error;
        if (props.currentError) {
          try {
            const { code, error, details } = JSON.parse(props.currentError?.message);
            if (code === 'missing-api-key') {
              message = (
                <div>
                  {error}{' '}
                  <a href="/settings" className="text-content-link hover:underline">
                    Set an API key
                  </a>{' '}
                  or switch to a different model provider.
                </div>
              );
            } else if (code === 'no-tokens') {
              message = (
                <div>
                  You&aposve used all the tokens included with your free plan.{' '}
                  <a href="/settings" className="text-content-link hover:underline">
                    Upgrade to a paid plan or add your own API key.
                  </a>
                </div>
              );
            } else {
              message = error;
            }
            if (details) {
              console.log('error details', details);
            }
          } catch (_) {
            console.log(props.currentError);
          }
        }
        break;
      case 'ready':
        icon = <CheckIcon />;
        message = STATUS_MESSAGES.generated;
        break;
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="-mb-2 mt-2 w-full max-w-chat rounded-t-xl border bg-background-secondary pb-2 shadow"
        initial={{ translateY: '100%' }}
        animate={{ translateY: '0%' }}
        exit={{ translateY: '100%' }}
        transition={{ duration: 0.15 }}
      >
        <div
          data-streaming-indicator-stream-status={streamStatus}
          className={classNames('border-none shadow-none rounded-t-xl relative w-full max-w-chat mx-auto z-prompt')}
        >
          <div
            className={classNames('bg-background-secondary/75', 'p-1.5 text-content-primary rounded-t-xl', '', 'flex')}
          >
            <div className="flex-1">
              <AnimatePresence>
                <div className="actions">
                  <div className={classNames('flex text-sm gap-3')}>
                    <div className="flex w-full items-center gap-1.5">
                      <div className="">{icon}</div>
                      {message}
                      <div className="min-h-6 grow" />
                      <LittleUsage teamSlug={teamSlug} streamStatus={streamStatus} />
                      {streamStatus === 'error' && (
                        <Button
                          type="button"
                          className="ml-2 h-auto"
                          onClick={props.resendMessage}
                          icon={<ResetIcon />}
                        >
                          Resend
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function UsageDonut({ tokenUsage, label }: { tokenUsage: { used: number; quota: number } | null; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-6">
        {tokenUsage ? <Donut current={tokenUsage.used} max={tokenUsage.quota} /> : <Loading className="size-4" />}
      </div>
      <div className="text-sm">{label}</div>
    </div>
  );
}

function displayChefTokenNumber(num: number) {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(0)}K`;
  }
  return num.toString();
}

function LittleUsage({ teamSlug, streamStatus }: { teamSlug: string | null; streamStatus: StreamStatus }) {
  const { isLoadingUsage, usagePercentage, used, quota, isPaidPlan, refetch } = useUsage({ teamSlug });
  const referralStats = useReferralStats();
  const entitlements = useEntitlements();
  const referralCode = useReferralCode();
  const loading = isLoadingUsage || !referralStats || !entitlements || !referralCode || !teamSlug;

  useEffect(() => {
    if (streamStatus === 'ready') {
      refetch();
    }
  }, [streamStatus, refetch]);

  if (!isLoadingUsage && (used == null || quota == null)) {
    return null;
  }

  // appears to the right of the donut
  const label = isPaidPlan
    ? usagePercentage > 100
      ? ``
      : `${Math.floor(usagePercentage)}% used`
    : usagePercentage < 100
      ? `${Math.floor(usagePercentage)}% used`
      : `out of tokens`;

  const detailedLabel = isPaidPlan
    ? `${displayChefTokenNumber(used)} used / ${displayChefTokenNumber(quota)} included tokens (${Math.floor(usagePercentage)}%)`
    : isLoadingUsage
      ? ''
      : usagePercentage < 100
        ? `${displayChefTokenNumber(used)} used / ${displayChefTokenNumber(quota)} Chef tokens (${Math.floor(usagePercentage)}%)`
        : `out of tokens`;

  const needsMore = !isPaidPlan;

  return (
    <div className={classNames('flex flex-col items-center', needsMore ? 'h-auto' : 'h-6')}>
      <Popover
        button={
          <button className="hover:text-content-primary">
            <div className="flex flex-col items-end gap-1 text-sm text-content-secondary">
              <UsageDonut tokenUsage={loading ? null : { used, quota }} label={label} />
              {needsMore && (
                <div className="border-b border-dotted border-content-secondary text-xs text-content-secondary hover:border-content-primary ">
                  Get more tokens
                </div>
              )}
            </div>
          </button>
        }
        placement="top-end"
        offset={[-4, 8]}
        portal={true}
        className="w-96"
      >
        {loading ? null : (
          <div className="space-y-2">
            <UsageDonut tokenUsage={loading ? null : { used, quota }} label={detailedLabel} />
            <p className="mt-1 text-xs text-content-secondary">
              Chef tokens power code generation with more expensive models using more Chef tokens. Your team&rsquo;s
              Chef tokens reset on the first of each month. Unused tokens from the previous month are not carried over.
            </p>
            <ul className="space-y-1.5 text-sm text-content-primary">
              {isPaidPlan ? (
                <li>
                  Beyond the {displayChefTokenNumber(quota)} per month included in your plan, Chef tokens cost $10 per
                  1M
                </li>
              ) : (
                <li>
                  <div className="flex flex-col items-center gap-2">
                    <p>
                      {referralStats.left === 5
                        ? 'Refer up to 5 new Chef users '
                        : `Refer up to ${referralStats.left} more new users `}
                      to get 85K Chef tokens each, now and every month
                    </p>
                    {referralStats.left > 0 && <Referrals referralCode={referralCode} />}
                  </div>
                </li>
              )}
              {isPaidPlan ? null : (
                <li>
                  <Button
                    href={`https://dashboard.convex.dev/t/${teamSlug}/settings/billing`}
                    target="_blank"
                    variant="unstyled"
                    className="underline hover:text-content-link"
                  >
                    Upgrade to a paid plan
                  </Button>{' '}
                  for 500K included Chef tokens every month
                </li>
              )}
              <li>
                <Button
                  href="/settings"
                  target="_blank"
                  variant="unstyled"
                  className="underline hover:text-content-link"
                >
                  Add your own API key
                </Button>{' '}
                in settings to avoid spending Chef tokens
              </li>
            </ul>
          </div>
        )}
      </Popover>
    </div>
  );
}

function Referrals({ referralCode }: { referralCode: string }) {
  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
  };

  return (
    <div className="-mx-2 w-full flex-1 rounded-md text-content-primary">
      <div className="relative flex w-full items-center gap-2">
        <input
          type="text"
          readOnly
          value={`https://convex.dev/referral/${referralCode}`}
          className="w-full flex-1 rounded-md border bg-bolt-elements-background-depth-2 px-3 py-1.5 text-sm text-content-primary"
        />
        <Button
          variant="neutral"
          size="xs"
          onClick={() => copyToClipboard(`https://convex.dev/referral/${referralCode}`)}
          tip="Copy link"
          icon={<ClipboardIcon />}
        />
      </div>
    </div>
  );
}
