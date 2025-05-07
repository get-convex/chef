import useEmblaCarousel from 'embla-carousel-react';
import Autoscroll from 'embla-carousel-auto-scroll';
import type { Tweet } from './TweetCard';
import TweetCard from './TweetCard';
import { classNames } from '~/utils/classNames';
import { useEffect } from 'react';

interface VerticalCarouselProps {
  tweets: Tweet[];
  direction?: 'forward' | 'backward';
  className?: string;
}

export default function VerticalCarousel({ tweets, direction = 'forward', className = '' }: VerticalCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ axis: 'y', loop: true, dragFree: false, watchDrag: false }, [
    Autoscroll({
      stopOnInteraction: false,
      stopOnMouseEnter: true,
      stopOnFocusIn: false,
      direction,
      speed: 0.5,
    }),
  ]);

  // Ensure the carousel restarts if tweets change.
  useEffect(() => {
    if (emblaApi) {
      emblaApi.reInit();
    }
  }, [tweets, emblaApi]);

  // Repeat the tweets to ensure seamless looping.
  const repeatedTweets = [...tweets, ...tweets];

  return (
    <div className={classNames('relative h-[60vh] min-h-96 overflow-hidden', className)}>
      <div ref={emblaRef} style={{ WebkitOverflowScrolling: 'touch', height: '100%' }}>
        <div className="flex h-full flex-col">
          {repeatedTweets.map((tweet, idx) => (
            <TweetCard
              tweet={tweet}
              key={tweet.link + idx}
              className="mb-6 select-none transition-colors hover:border-neutral-5 hover:dark:border-neutral-5"
            />
          ))}
        </div>
      </div>
      {/* Optional: Add a gradient overlay at top and bottom for effect */}
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-8 w-full bg-gradient-to-b from-white/80 to-transparent dark:from-[var(--bolt-elements-bg-depth-1)]" />
      <div className="pointer-events-none absolute bottom-0 left-0 z-10 h-8 w-full bg-gradient-to-t from-white/80 to-transparent dark:from-[var(--bolt-elements-bg-depth-1)]" />
    </div>
  );
}
