import styles from './SpinnerThreeDots.module.css';

// Based on https://github.com/n3r4zzurr0/svg-spinners/blob/main/svg-css/3-dots-fade.svg
export function SpinnerThreeDots({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle className={styles.Dot1} cx="4" cy="12" r="3" fill="currentColor" />
      <circle className={styles.Dot2} cx="12" cy="12" r="3" fill="currentColor" />
      <circle className={styles.Dot3} cx="20" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}
