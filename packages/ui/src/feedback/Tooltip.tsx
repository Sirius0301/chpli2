import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../cx';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  placement?: 'top' | 'bottom';
  /** Delay before showing, in ms. */
  delay?: number;
  disabled?: boolean;
  className?: string;
  /** Optional anchor ref (e.g. the truncating span inside OverflowTooltip). */
  triggerRef?: RefObject<HTMLElement>;
  triggerTabIndex?: number;
}

interface Position {
  top: number;
  left: number;
  placement: 'top' | 'bottom';
}

/**
 * Lightweight hover/focus tooltip. It portals to document.body so it is not
 * clipped by sidebar/drawer overflow, and positions itself above/below the
 * trigger. Text is supplied by the caller; no built-in copy.
 */
export function Tooltip({
  content,
  children,
  placement = 'top',
  delay = 150,
  disabled = false,
  className,
  triggerRef,
  triggerTabIndex,
}: TooltipProps) {
  const ownRef = useRef<HTMLSpanElement>(null);
  const anchorRef = triggerRef ?? ownRef;
  const timer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position>({ top: 0, left: 0, placement });
  const tooltipId = useId();

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    setOpen(false);
  }, []);

  const show = useCallback(() => {
    if (disabled || !content) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), delay);
  }, [content, delay, disabled]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = anchorRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    // Flip when the preferred side would put the tooltip under the toolbar
    // or past the viewport edge; vertical-only is enough for this UI.
    const flipTop = placement === 'top' && rect.top < 72 && rect.bottom + 72 < window.innerHeight;
    const flipBottom =
      placement === 'bottom' && rect.bottom > window.innerHeight - 72 && rect.top > 72;
    const resolved = flipTop ? 'bottom' : flipBottom ? 'top' : placement;
    setPosition({
      top: resolved === 'top' ? rect.top - 8 : rect.bottom + 8,
      left: rect.left + rect.width / 2,
      placement: resolved,
    });
  }, [anchorRef, open, placement]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <span
      ref={triggerRef ?? ownRef}
      className={cx(styles.trigger, className)}
      tabIndex={triggerTabIndex}
      aria-describedby={open ? tooltipId : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open &&
        content &&
        createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            className={cx(styles.tooltip, position.placement === 'top' ? styles.top : styles.bottom)}
            style={{ top: position.top, left: position.left }}
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  );
}
