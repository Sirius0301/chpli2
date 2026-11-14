import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cx } from '../cx';
import styles from './Select.module.css';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

/** Styled native select — same chrome as Input, custom chevron. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error = false, className, children, ...rest }, ref) => (
    <select
      ref={ref}
      className={cx(styles.select, error && styles.error, className)}
      {...rest}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';
