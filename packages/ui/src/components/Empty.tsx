import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Empty.module.css';

export interface EmptyProps {
  /** Primary message; pass a translated string. */
  text: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Neutral empty state: dot glyph + message + optional action slot. */
export function Empty({ text, children, className }: EmptyProps) {
  return (
    <div className={cx(styles.empty, className)}>
      <svg className={styles.glyph} viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="16" fill="none" strokeWidth="2" />
        <circle cx="19" cy="21" r="2" fill="currentColor" />
        <circle cx="29" cy="21" r="2" fill="currentColor" />
        <path d="M18 29q6 4 12 0" fill="none" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className={styles.text}>{text}</div>
      {children && <div className={styles.action}>{children}</div>}
    </div>
  );
}
