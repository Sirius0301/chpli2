import { useLayoutEffect, useRef, useState } from 'react';
import { cx } from '../cx';
import { Tooltip } from './Tooltip';
import styles from './OverflowTooltip.module.css';

export interface OverflowTooltipProps {
  text: string;
  className?: string;
  placement?: 'top' | 'bottom';
  delay?: number;
}

/**
 * Truncated text with an automatic tooltip: the tooltip only appears when
 * the rendered element actually overflows. The full text remains in the DOM,
 * so screen readers never depend on hover.
 */
export function OverflowTooltip({
  text,
  className,
  placement = 'top',
  delay = 150,
}: OverflowTooltipProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  useLayoutEffect(() => {
    const check = () => {
      const el = textRef.current;
      setOverflow(el !== null && el.scrollWidth > el.clientWidth + 1);
    };
    check();
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check);
    if (textRef.current) observer?.observe(textRef.current);
    window.addEventListener('resize', check);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', check);
    };
  }, [text]);

  return (
    <Tooltip
      content={text}
      placement={placement}
      delay={delay}
      disabled={!overflow}
      triggerRef={wrapperRef}
      className={cx(styles.trigger, className)}
    >
      <span ref={textRef} className={styles.text}>
        {text}
      </span>
    </Tooltip>
  );
}
