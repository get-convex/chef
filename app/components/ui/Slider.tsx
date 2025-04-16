import { motion } from 'framer-motion';
import React, { type ReactNode, memo } from 'react';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { genericMemo } from '~/utils/react';

interface SliderOption<T> {
  value: T;
  text: ReactNode;
}

export interface SliderOptions<T> {
  options: SliderOption<T>[];
}

interface SliderProps<T> {
  selected: T;
  options: SliderOptions<T>;
  setSelected?: (selected: T) => void;
}

export const Slider = genericMemo(function Slider<T>({ selected, options, setSelected }: SliderProps<T>) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1 overflow-hidden rounded-full bg-bolt-elements-background-depth-1 p-1">
      {options.options.map((option) => (
        <SliderButton
          key={String(option.value)}
          selected={selected === option.value}
          setSelected={() => setSelected?.(option.value)}
        >
          {option.text}
        </SliderButton>
      ))}
    </div>
  );
});

const SliderButton = memo(function SliderButton({
  selected,
  setSelected,
  children,
}: React.PropsWithChildren<{
  selected: boolean;
  setSelected: () => void;
}>) {
  return (
    <button
      onClick={setSelected}
      className={classNames(
        'bg-transparent text-sm px-2.5 py-0.5 rounded-full relative',
        selected
          ? 'text-bolt-elements-item-contentAccent'
          : 'text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive',
      )}
    >
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      {selected && (
        <motion.span
          layoutId="pill-tab"
          transition={{ duration: 0.2, ease: cubicEasingFn }}
          className="absolute inset-0 z-0 rounded-full bg-bolt-elements-item-backgroundAccent"
        ></motion.span>
      )}
    </button>
  );
});
