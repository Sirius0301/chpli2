import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Chip.module.css';

interface ChipVisualProps {
  children: ReactNode;
  /** Color emphasis; defaults to neutral. */
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

/** A removable chip must provide a localized accessible label. */
export type ChipProps = ChipVisualProps &
  (
    | { onRemove: () => void; removeLabel: string }
    | { onRemove?: undefined; removeLabel?: undefined }
  );

export function Chip({
  children,
  tone = 'default',
  onRemove,
  removeLabel,
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
