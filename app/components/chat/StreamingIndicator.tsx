import { AnimatePresence, motion } from 'framer-motion';
import type { ToolStatus } from '~/lib/common/types';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chatId';
import { Spinner } from '~/components/ui/Spinner';
import { ExclamationTriangleIcon, CheckCircledIcon, ResetIcon } from '@radix-ui/react-icons';
import { useEffect, useState } from 'react';

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
  let message: string;

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
            const { error, details } = JSON.parse(props.currentError?.message);
            message = error;
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
      <div
        className={classNames(
          'bg-bolt-elements-background-depth-2',
          'border border-bolt-elements-borderColor',
          'rounded-lg relative w-full max-w-chat mx-auto z-prompt',
        )}
      >
        <div
          className={classNames(
            'bg-bolt-elements-item-backgroundAccent',
            'p-2 rounded-lg text-bolt-elements-item-contentAccent',
            'flex',
          )}
        >
          <div className="flex-1">
            <AnimatePresence>
              <motion.div
                className="actions"
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: '0px' }}
                transition={{ duration: 0.15 }}
              >
                <motion.div
                  className={classNames('flex text-sm gap-3')}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="flex w-full items-center gap-1.5">
                    <div>{icon}</div>
                    {message}
                    <div className="grow" />
                    {streamStatus === 'error' && (
                      <button
                        type="button"
                        className="flex items-center gap-1 rounded-md bg-bolt-elements-button-primary-background px-2 py-1.5 text-bolt-elements-button-primary-text transition-colors hover:bg-bolt-elements-button-primary-backgroundHover"
                        onClick={props.resendMessage}
                      >
                        <ResetIcon />
                        Resend
                      </button>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </AnimatePresence>
  );
}
