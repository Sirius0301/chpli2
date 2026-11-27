import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { cx } from '../cx';
import styles from './ResizeHandle.module.css';

export type ResizeDirection = 'grow-right' | 'grow-left';

export interface ResizeHandleProps {
  value: number;
  min: number;
  max: number;
  /** grow-right: dragging right widens a left rail; grow-left: a right panel. */
  direction: ResizeDirection;
  onChange: (value: number) => void;
  /** Localized accessible name, e.g. "Resize Memo sidebar". */
  label: string;
  className?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Keyboard- and pointer-accessible vertical splitter. Presentational and
 * controlled: the app owns the width and persistence.
 */
export function ResizeHandle({
  value,
  min,
  max,
  direction,
  onChange,
  label,
  className,
}: ResizeHandleProps) {
  const dragging = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    dragging.current = false;
    cleanupRef.current?.();
    cleanupRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => stop, [stop]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startValue = value;
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      if (!dragging.current) return;
      const delta =
        direction === 'grow-right' ? moveEvent.clientX - startX : startX - moveEvent.clientX;
      onChange(clamp(startValue + delta, min, max));
    };
    const onUp = () => stop();

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    cleanupRef.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const grow = direction === 'grow-right' ? 'ArrowRight' : 'ArrowLeft';
    const shrink = direction === 'grow-right' ? 'ArrowLeft' : 'ArrowRight';
    const step = event.shiftKey ? 32 : 8;
    if (event.key !== grow && event.key !== shrink && event.key !== 'Home' && event.key !== 'End') {
      return;
    }
    event.preventDefault();
    if (event.key === 'Home') onChange(min);
    else if (event.key === 'End') onChange(max);
    else if (event.key === grow) onChange(clamp(value + step, min, max));
    else onChange(clamp(value - step, min, max));
  };

  return (
    <div
      className={cx(styles.handle, className)}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <span className={styles.line} aria-hidden />
    </div>
  );
}
