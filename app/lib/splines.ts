import { useEffect, useState } from 'react';

const SPLINES_MESSAGES = [
  'Reticulating splines...',
  'Procuring VHS casettes...',
  'Adding an "n" to Covex...',
  'Twisting knobs...',
  'Booking a Hot Pockets gig...',
  'Consulting Chef Goyardee...',
  'Going base jumping...',
  'Painting sneakers...',
];
const SPLINES_PROBABILITY = 0.2;
const SPLINES_DURATION = 2000;

export function useSplines(loading: boolean) {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (loading) {
      timer = setInterval(() => {
        let newMessage = null;
        if (Math.random() < SPLINES_PROBABILITY) {
          const randomIndex = Math.floor(Math.random() * SPLINES_MESSAGES.length);
          newMessage = SPLINES_MESSAGES[randomIndex];
        }
        setMessage(newMessage);
      }, SPLINES_DURATION);
    }
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [loading]);
  return message;
}
