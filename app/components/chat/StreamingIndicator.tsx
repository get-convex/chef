import { AnimatePresence, motion } from 'framer-motion';
import type { ToolStatus } from '~/lib/common/types';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chatId';
import { Spinner } from '@ui/Spinner';
import { ExclamationTriangleIcon, CheckCircledIcon, ResetIcon } from '@radix-ui/react-icons';
import { useEffect, useState } from 'react';
import { Button } from '@ui/Button';

interface StreamingIndicatorProps {
  streamStatus: 'streaming' | 'submitted' | 'ready' | 'error';
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
                      <div>{icon}</div>
                      {message}
                      <div className="grow" />
                      {streamStatus === 'error' && (
                        <Button type="button" onClick={props.resendMessage} icon={<ResetIcon />}>
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
