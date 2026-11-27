import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { cx } from '../cx';
import { ResizeHandle } from './ResizeHandle';
import styles from './SidePanel.module.css';

export interface SidePanelProps {
  /** Defaults to true so conditional rendering at the call site is enough. */
  open?: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Localized accessible name for the close button. */
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md';
  /** Controlled width; overrides the size preset when provided. */
  width?: number;
  resizable?: boolean;
  minWidth?: number;
  maxWidth?: number;
  /** Localized accessible name for the splitter. */
  resizeLabel?: string;
  onWidthChange?: (width: number) => void;
  /** Position the panel inside a relative parent (e.g. the note editor). */
  contained?: boolean;
  /** Turn the <=600px layout into a bottom sheet instead of a full drawer. */
  mobileSheet?: boolean;
  /** Set to dialog/alertdialog when the panel is genuinely modal. */
  role?: 'dialog' | 'alertdialog' | 'complementary';
  ariaLabel?: string;
  className?: string;
  backdropClassName?: string;
}

/**
 * Responsive right-hand panel. Desktop renders an inline column inside the
 * workspace; <=900px it becomes an overlay drawer, and with `mobileSheet`
 * <=600px becomes a bottom sheet. The parent owns visibility: this component
 * is presentational and never mutates data.
 */
export function SidePanel({
  open = true,
  onClose,
  title,
  closeLabel,
  children,
  footer,
  size = 'md',
  width,
  resizable = false,
  minWidth = 280,
  maxWidth = 640,
  resizeLabel,
  onWidthChange,
  contained = false,
  mobileSheet = false,
  role,
  ariaLabel,
  className,
  backdropClassName,
}: SidePanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const modal = role === 'dialog' || role === 'alertdialog';
  const effectiveWidth = width ?? (size === 'sm' ? 300 : 320);
  const style = {
    '--chpli-side-panel-width': `${effectiveWidth}px`,
  } as CSSProperties;

  return (
    <div
      className={cx(styles.wrap, contained && styles.contained, mobileSheet && styles.sheet)}
      data-testid="side-panel"
    >
      {!contained && (
        <div
          className={cx(styles.backdrop, backdropClassName)}
          onClick={onClose}
          aria-hidden
        />
      )}
      {resizable && onWidthChange && resizeLabel && (
        <ResizeHandle
          value={effectiveWidth}
          min={minWidth}
          max={maxWidth}
          direction="grow-left"
          onChange={onWidthChange}
          label={resizeLabel}
        />
      )}
      <aside
        className={cx(styles.panel, size === 'sm' ? styles.sm : styles.md, className)}
        style={style}
        role={role}
        aria-modal={modal || undefined}
        aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)}
      >
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <Button size="sm" variant="text" aria-label={closeLabel} onClick={onClose}>
            ×
          </Button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </aside>
    </div>
  );
}
