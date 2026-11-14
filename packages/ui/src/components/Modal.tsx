import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../cx';
import styles from './Modal.module.css';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Footer slot; pass Buttons for the classic right-aligned action row. */
  footer?: ReactNode;
  width?: number;
  children: ReactNode;
}

/**
 * Portal-rendered dialog. Closes on Esc and mask click. The caller owns
 * visibility state (`open`); nothing here writes to your data.
 */
export function Modal({ open, onClose, title, footer, width = 520, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className={styles.mask} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.card} style={{ width }} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <div className={styles.title}>{title}</div>
          <button type="button" className={styles.close} aria-label="close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
