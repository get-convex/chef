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
import { useReferralCode, useReferralStats } from '~/lib/hooks/useReferralCode';
import { Popover } from '@ui/Popover';
import { hasApiKeySet } from '~/lib/common/apiKey';
import type { ModelSelection } from '~/utils/constants';
import { useLaunchDarkly } from '~/lib/hooks/useLaunchDarkly';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';

type StreamStatus = 'streaming' | 'submitted' | 'ready' | 'error';

interface StreamingIndicatorProps {
  streamStatus: StreamStatus;
  numMessages: number;
  numSubchats: number;
  toolStatus?: ToolStatus;
  currentError?: Error;
  resendMessage: () => void;
  modelSelection: ModelSelection;
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

  if (streamStatus === 'ready' && props.numMessages === 0 && props.numSubchats === 1) {
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
                  You&apos;ve used all the tokens included with your free plan.{' '}
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
        if (props.numMessages > 0) {
          icon = <CheckIcon />;
          message = STATUS_MESSAGES.generated;
        }
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
                      <LittleUsage
                        teamSlug={teamSlug}
                        streamStatus={streamStatus}
                        modelSelection={props.modelSelection}
                      />
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

function UsageDonut({
  tokenUsage,
  label,
  hidden,
}: {
  tokenUsage: { used: number; quota: number } | null;
  label: string;
  hidden: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={classNames('h-6', { invisible: hidden })}>
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

function LittleUsage({
  teamSlug,
  streamStatus,
  modelSelection,
}: {
  teamSlug: string | null;
  streamStatus: StreamStatus;
  modelSelection: ModelSelection;
}) {
  const { isLoadingUsage, usagePercentage, used, quota, isPaidPlan, refetch } = useUsage({ teamSlug });
  const referralStats = useReferralStats();
  const referralCode = useReferralCode();
  const loading = isLoadingUsage || !referralStats || !referralCode || !teamSlug;
  const { useGeminiAuto } = useLaunchDarkly();
  const apiKey = useQuery(api.apiKeys.apiKeyForCurrentMember);

  useEffect(() => {
    if (streamStatus === 'ready') {
      refetch();
    }
  }, [streamStatus, refetch]);

  if (!isLoadingUsage && (used == null || quota == null)) {
    return null;
  }

  const usingApiKey = hasApiKeySet(modelSelection, useGeminiAuto, apiKey);
  const alwaysUsingApiKey = usingApiKey && apiKey?.preference === 'always';

  // show referral or upgrade CTA
  const needsMore = !isPaidPlan && !alwaysUsingApiKey && !(usingApiKey && usagePercentage > 100);
  // donut isn't relevant if always using API key
  const hideDonut = alwaysUsingApiKey || (!!isPaidPlan && usagePercentage > 100);

  // appears to the right of the donut
  const label = alwaysUsingApiKey
    ? `Using API key instead of tokens`
    : isPaidPlan
      ? usagePercentage > 100
        ? usingApiKey
          ? `Using API key`
          : `Token usage`
        : `${Math.floor(usagePercentage)}% tokens used`
      : usagePercentage > 100
        ? usingApiKey
          ? `Using API key`
          : `Out of tokens`
        : `${Math.floor(usagePercentage)}% tokens used`;

  const detailedLabel = isPaidPlan
    ? `${displayChefTokenNumber(used)} tokens used / ${displayChefTokenNumber(quota)} included (${Math.floor(usagePercentage)}%)`
    : isLoadingUsage
      ? ''
      : usagePercentage < 100
        ? `${displayChefTokenNumber(used)} tokens used / ${displayChefTokenNumber(quota)} (${Math.floor(usagePercentage)}%)`
        : usingApiKey
          ? `Out of tokens (${displayChefTokenNumber(used)} used), using API key`
          : `Out of tokens`;

  return (
    <div className={classNames('flex flex-col items-center', needsMore ? 'h-auto' : 'h-6')}>
      <Popover
        button={
          <button className="hover:text-content-primary">
            <div className="flex flex-col items-end gap-1 text-sm text-content-secondary">
              <UsageDonut tokenUsage={loading ? null : { used, quota }} label={label} hidden={hideDonut} />
              {needsMore && (
                <div className="border-b border-dotted border-content-secondary text-xs text-content-secondary hover:border-content-primary ">
                  Upgrade or refer a friend to get more tokens
                </div>
              )}
            </div>
          </button>
        }
        placement="top-end"
        offset={[6, 8]}
        portal={true}
        className="w-96"
      >
        {loading ? null : (
          <div>
            <UsageDonut tokenUsage={loading ? null : { used, quota }} label={detailedLabel} hidden={false} />
            <p className="mt-1 text-xs text-content-secondary">
              {isPaidPlan
                ? `Chef tokens power code generation. Your team's Chef tokens reset to ${displayChefTokenNumber(quota)} on your regular billing cycle. Unused tokens from the previous month are not carried over. Additional Chef tokens cost $10 per 1M tokens.`
                : 'Chef tokens power code generation. Tokens reset on the first of each month and tokens from the previous month are not carried over.'}
            </p>
            <ul className="mt-2 space-y-2 text-sm text-content-primary">
              {isPaidPlan ? null : (
                <li className="mt-2 border-t pt-2">
                  <Button
                    href={`https://dashboard.convex.dev/t/${teamSlug}/settings/billing?source=chef`}
                    target="_blank"
                    variant="unstyled"
                    className="underline hover:text-content-link"
                  >
                    Upgrade your plan
                  </Button>{' '}
                  to get more tokens.
                </li>
              )}
              {!isPaidPlan && (
                <li className="border-t pt-2">
                  <div className="flex flex-col items-center gap-2">
                    <p>
                      {referralStats.left === 5
                        ? 'Refer a friend '
                        : `Refer up to ${referralStats.left} more new users `}
                      to get 85K additional Chef tokens per month.
                    </p>
                    {referralStats.left > 0 && <Referrals referralCode={referralCode} />}
                  </div>
                </li>
              )}
              <li className="mt-2 border-t pt-2 text-xs text-content-secondary">
                {usingApiKey ? (
                  usagePercentage >= 100 ? (
                    "You're using an API key so can keep building without using Chef tokens."
                  ) : (
                    "You have an API key set for the model you're using so you'll be able to keep building after running out of Chef tokens."
                  )
                ) : (
                  <>
                    <Button
                      href="/settings"
                      target="_blank"
                      variant="unstyled"
                      className="underline hover:text-content-link"
                    >
                      Add your own API key
                    </Button>{' '}
                    in settings to avoid spending Chef tokens.
                  </>
                )}
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
          value={`https://convex.dev/try-chef/${referralCode}`}
          className="w-full flex-1 rounded-md border bg-bolt-elements-background-depth-2 px-3 py-1.5 text-sm text-content-primary"
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
  );
}
