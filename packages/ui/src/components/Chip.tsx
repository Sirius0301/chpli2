import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Chip.module.css';

export interface ChipProps {
  children: ReactNode;
  /** Color emphasis; defaults to neutral. */
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  /** When provided, renders a remove (×) affordance. */
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
}

export function Chip({
  children,
  tone = 'default',
  onRemove,
  removeLabel = 'remove',
  className,
}: ChipProps) {
  return (
    <span className={cx(styles.chip, styles[`tone-${tone}`], className)}>
      <span className={styles.label}>{children}</span>
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          aria-label={removeLabel}
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </span>
  );
}
