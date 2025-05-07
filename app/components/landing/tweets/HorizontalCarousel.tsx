import useEmblaCarousel from 'embla-carousel-react';
import type { Tweet } from './TweetCard';
import TweetCard from './TweetCard';
import { classNames } from '~/utils/classNames';

interface HorizontalCarouselProps {
  tweets: Tweet[];
  className?: string;
}

export default function HorizontalCarousel({ tweets, className = '' }: HorizontalCarouselProps) {
  const [emblaRef] = useEmblaCarousel({ align: 'center', loop: true });

  return (
    <div className={classNames('relative overflow-hidden', className)}>
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-8 bg-gradient-to-r to-transparent dark:from-[var(--bolt-elements-bg-depth-1)]" />
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l to-transparent dark:from-[var(--bolt-elements-bg-depth-1)]" />
      <div ref={emblaRef} style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex cursor-grab">
          {tweets.map((tweet) => (
            <TweetCard tweet={tweet} key={tweet.link} className="mx-2 min-w-72 select-none" />
          ))}
        </div>
      </div>
    </div>
  );
}
