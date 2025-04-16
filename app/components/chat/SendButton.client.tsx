import { AnimatePresence, cubicBezier, motion } from 'framer-motion';
import { ArrowRightIcon, StopIcon } from '@radix-ui/react-icons';
import { classNames } from '~/utils/classNames';
import { Button, buttonClasses } from '@ui/Button';
import React from 'react';

interface SendButtonProps {
  show: boolean;
  isStreaming?: boolean;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  tip?: string;
}

const customEasingFn = cubicBezier(0.4, 0, 0.2, 1);

const MotionButton = motion.create(Button);

export const SendButton = React.memo(({ show, isStreaming, disabled, onClick, tip }: SendButtonProps) => {
  return (
    <AnimatePresence>
      {show ? (
        <MotionButton
          className={classNames(
            buttonClasses({ disabled }),
            'transition-theme absolute right-[22px] top-[18px] size-[34px] items-center justify-center',
          )}
          tip={tip}
          transition={{ ease: customEasingFn, duration: 0.17 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          disabled={disabled}
          onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            event.preventDefault();

            if (!disabled) {
              onClick?.(event);
            }
          }}
        >
          <div className="text-lg">{!isStreaming ? <ArrowRightIcon /> : <StopIcon />}</div>
        </MotionButton>
      ) : null}
    </AnimatePresence>
  );
});
