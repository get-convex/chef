import { AnimatePresence, cubicBezier, motion } from 'framer-motion';
import { MagicWandIcon } from '@radix-ui/react-icons';
import { classNames } from '~/utils/classNames';
import { Button, buttonClasses } from '@ui/Button';
import React from 'react';
import { Spinner } from '@ui/Spinner';

interface EnhancePromptButtonProps {
  show: boolean;
  isEnhancing?: boolean;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  tip?: string;
}

const customEasingFn = cubicBezier(0.4, 0, 0.2, 1);

const MotionButton = motion.create(Button);

export const EnhancePromptButton = React.memo(function EnhancePromptButton({
  show,
  isEnhancing,
  disabled,
  onClick,
  tip,
}: EnhancePromptButtonProps) {
  return (
    <AnimatePresence>
      {show ? (
        <MotionButton
          className={classNames(
            buttonClasses({ disabled, variant: 'neutral' }),
            'transition-theme absolute right-[60px] top-[18px] size-[34px] items-center justify-center',
          )}
          tip={tip || "Enhance your prompt with GPT-4.1 Mini"}
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
          <div className="text-lg">
            {!isEnhancing ? <MagicWandIcon /> : <Spinner className="size-4" />}
          </div>
        </MotionButton>
      ) : null}
    </AnimatePresence>
  );
});