import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Field.module.css';

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** `div` for groups (checkbox clusters) where a wrapping label is invalid. */
  as?: 'label' | 'div';
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Label + control + hint/error wrapper. The control is wrapped by the label
 * (implicit association) while hint/error stay outside it, so the accessible
 * name remains the label text — `getByLabel('Title')` keeps working even when
 * a hint is present.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  as = 'label',
  htmlFor,
  className,
  children,
}: FieldProps) {
  const labelContent = (
    <span className={styles.label}>
      {label}
      {required && <span aria-hidden> *</span>}
    </span>
  );

  return (
    <div className={cx(styles.field, className)}>
      {as === 'label' ? (
        <label className={styles.labelWrap} htmlFor={htmlFor}>
          {labelContent}
          {children}
        </label>
      ) : (
        <>
          {labelContent}
          {children}
        </>
      )}
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className={styles.hint}>{hint}</span>
      ) : null}
    </div>
  );
}
