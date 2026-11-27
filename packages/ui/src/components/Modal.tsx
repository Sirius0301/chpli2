import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Footer slot; pass Buttons for the classic right-aligned action row. */
  footer?: ReactNode;
  width?: number;
  /** Use alertdialog for confirmations that interrupt the current task. */
  role?: 'dialog' | 'alertdialog';
  /** Localized accessible name for the close button. */
  closeLabel: string;
  children: ReactNode;
}

/**
 * Portal-rendered dialog. Closes on Esc and mask click. The caller owns
 * visibility state (`open`); nothing here writes to your data.
 */
export function Modal({
  open,
  onClose,
  title,
  footer,
  width = 520,
  role = 'dialog',
  closeLabel,
  children,
}: ModalProps) {
  const titleId = useId();

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
      <div
        className={styles.card}
        style={{ width }}
        role={role}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        <div className={styles.header}>
          <div className={styles.title} id={titleId}>
            {title}
          </div>
          <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}>
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
