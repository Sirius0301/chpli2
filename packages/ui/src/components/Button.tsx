import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** default: bordered neutral; primary: solid brand; danger: destructive; text: borderless */
  variant?: 'default' | 'primary' | 'danger' | 'text';
  size?: 'sm' | 'md';
  /** Stretch to fill the container width. */
  block?: boolean;
  icon?: ReactNode;
  /** When provided the Button renders as an anchor (e.g. downloads). */
  href?: string;
  download?: string | boolean;
}

export function Button({
  variant = 'default',
  size = 'md',
  block = false,
  icon,
  className,
  children,
  type = 'button',
  href,
  download,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = cx(
    styles.button,
    styles[`variant-${variant}`],
    styles[`size-${size}`],
    block && styles.block,
    className,
  );
  const content = (
    <>
      {icon && <span className={styles.icon}>{icon}</span>}
      {children}
    </>
  );
  if (href && !disabled) {
    return (
      <a className={classes} href={href} download={download} {...(rest as Record<string, unknown>)}>
        {content}
      </a>
    );
  }
  return (
    <button type={type} className={classes} disabled={disabled} {...rest}>
      {content}
    </button>
  );
}
