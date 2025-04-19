import { useRef, useCallback } from 'react';

/** Pixels from bottom to consider “scrolled to bottom” */
const BOTTOM_THRESHOLD = 50;

export function useSnapScroll() {
  const autoScrollRef = useRef(true);
  const scrollNodeRef = useRef<HTMLDivElement>();
  const onScrollRef = useRef<() => void>();
  const observerRef = useRef<ResizeObserver>();
  const lastScrollTopRef = useRef<number>(0);

  const messageRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const observer = new ResizeObserver(() => {
        if (!autoScrollRef.current) {
          return;
        }

        if (autoScrollRef.current && scrollNodeRef.current) {
          const { scrollHeight, clientHeight } = scrollNodeRef.current;
          const scrollTarget = scrollHeight - clientHeight;

          scrollNodeRef.current.scrollTo({
            top: scrollTarget,
            behavior: 'smooth',
          });
        }
      });

      observer.observe(node);
      observerRef.current = observer;
    } else {
      observerRef.current?.disconnect();
      observerRef.current = undefined;
    }
  }, []);

  const scrollRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      onScrollRef.current = () => {
        const { scrollTop } = node;

        // Detect scroll direction
        const isScrollingUp = scrollTop < lastScrollTopRef.current;

        // Update auto-scroll based on scroll direction and position
        if (isScrollingUp) {
          // Disable auto-scroll when scrolling up
          autoScrollRef.current = false;
        } else if (isScrolledToBottom(node)) {
          // Re-enable auto-scroll when manually scrolled to bottom
          autoScrollRef.current = true;
        }

        // Store current scroll position for next comparison
        lastScrollTopRef.current = scrollTop;
      };

      node.addEventListener('scroll', onScrollRef.current);
      scrollNodeRef.current = node;
    } else {
      if (onScrollRef.current && scrollNodeRef.current) {
        scrollNodeRef.current.removeEventListener('scroll', onScrollRef.current);
      }

      scrollNodeRef.current = undefined;
      onScrollRef.current = undefined;
    }
  }, []);

  const enableAutoScroll = useCallback(() => {
    autoScrollRef.current = true;
  }, []);

  return { messageRef, scrollRef, enableAutoScroll };
}

function isScrolledToBottom(element: HTMLDivElement): boolean {
  const { scrollTop, scrollHeight, clientHeight } = element;
  return scrollHeight - scrollTop - clientHeight <= BOTTOM_THRESHOLD;
}
