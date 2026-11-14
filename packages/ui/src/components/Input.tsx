import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx } from '../cx';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Validation error state — renders danger border. */
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error = false, className, ...rest }, ref) => (
    <input
      ref={ref}
      className={cx(styles.control, error && styles.error, className)}
      {...rest}
    />
  ),
);
Input.displayName = 'Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error = false, className, ...rest }, ref) => (
    <textarea
      ref={ref}
      className={cx(styles.control, styles.textarea, error && styles.error, className)}
      {...rest}
    />
  ),
);
Textarea.displayName = 'Textarea';
