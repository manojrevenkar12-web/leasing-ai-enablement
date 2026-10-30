import type { ReactNode } from 'react';
import styles from './ui.module.css';

/** Something went wrong: say what, and offer the way out. */
export function ErrorState({ title, message, onRetry, retryLabel = 'Erneut versuchen' }: { title: string; message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div role="alert" className={styles.state}>
      <h2 className={styles.stateTitle}>{title}</h2>
      <p className={styles.stateText}>{message}</p>
      {onRetry ? (
        <button type="button" className={styles.button} onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

/** Nothing to show yet: an invitation to act, not a mood. */
export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className={styles.state}>
      <h2 className={styles.stateTitle}>{title}</h2>
      <p className={styles.stateText}>{message}</p>
      {action}
    </div>
  );
}

export function Skeleton({ width, height, label }: { width?: string; height?: string; label?: string }) {
  return <span className={styles.skeleton} style={{ width, height }} aria-hidden={label ? undefined : true} aria-label={label} />;
}
