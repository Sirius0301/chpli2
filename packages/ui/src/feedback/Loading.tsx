import { cx } from '../cx';
import styles from './Loading.module.css';

export interface LoadingProps {
  label: string;
  className?: string;
}

/** Minimal status line for page-level loading states. */
export function Loading({ label, className }: LoadingProps) {
  return (
    <p className={cx(styles.loading, className)} role="status">
      {label}
    </p>
  );
}
