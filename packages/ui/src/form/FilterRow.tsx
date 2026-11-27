import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './FilterRow.module.css';

export interface FilterRowProps {
  checked: boolean;
  onToggle: () => void;
  label: ReactNode;
  count?: number;
  /** Optional semantic color class supplied by the app (priority/status). */
  labelClassName?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * One checkbox filter row: checkbox + label + optional count. Shared by
 * sidebar filters so the checkbox/label/count markup and truncation behavior
 * stay identical across modules; the app still owns the filter semantics.
 */
export function FilterRow({
  checked,
  onToggle,
  label,
  count,
  labelClassName,
  className,
  disabled = false,
}: FilterRowProps) {
  return (
    <label className={cx(styles.row, className)}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} />
      <span className={cx(styles.label, labelClassName)}>{label}</span>
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </label>
  );
}
