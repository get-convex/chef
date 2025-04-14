import { AnimatePresence, cubicBezier, motion } from 'framer-motion';
import { ArrowRightIcon, StopIcon } from '@radix-ui/react-icons';

interface SendButtonProps {
  show: boolean;
  isStreaming?: boolean;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onImagesSelected?: (images: File[]) => void;
}

const customEasingFn = cubicBezier(0.4, 0, 0.2, 1);

export const SendButton = ({ show, isStreaming, disabled, onClick }: SendButtonProps) => {
  return (
    <AnimatePresence>
      {show ? (
        <motion.button
          className="transition-theme absolute right-[22px] top-[18px] flex size-[34px] items-center justify-center rounded-md bg-bolt-elements-button-primary-background p-1 text-white hover:bg-bolt-elements-button-primary-backgroundHover disabled:cursor-not-allowed disabled:bg-bolt-elements-background-depth-3 disabled:opacity-50 disabled:hover:bg-bolt-elements-background-depth-3"
          transition={{ ease: customEasingFn, duration: 0.17 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();

            if (!disabled) {
              onClick?.(event);
            }
          }}
        >
          <div className="text-lg">{!isStreaming ? <ArrowRightIcon /> : <StopIcon />}</div>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
};
