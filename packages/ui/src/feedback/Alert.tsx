import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Alert.module.css';

export interface AlertProps {
  tone?: 'danger' | 'warning' | 'success' | 'info';
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Inline message with an optional right-aligned action (e.g. Retry). */
export function Alert({ tone = 'info', action, className, children }: AlertProps) {
  return (
    <div
      className={cx(styles.alert, styles[tone], className)}
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
    >
      <div className={styles.message}>{children}</div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
