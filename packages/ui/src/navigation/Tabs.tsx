import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Tabs.module.css';

export interface TabItem<T extends string = string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  title?: string;
}

export interface TabsProps<T extends string = string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'pill' | 'underline';
  size?: 'sm' | 'md';
  ariaLabel?: string;
  className?: string;
}

/**
 * Accessible tab strip with arrow/Home/End navigation. Visual variants cover
 * the two existing languages in the app: pill (Calendar/Bookmarks view
 * switches) and underline (Notes edit/preview, Host auth).
 */
export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  variant = 'underline',
  size = 'md',
  ariaLabel,
  className,
}: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const enabled = items
      .map((item, itemIndex) => ({ item, itemIndex }))
      .filter(({ item }) => !item.disabled);
    if (enabled.length === 0) return;

    const current = enabled.findIndex(({ itemIndex }) => itemIndex === index);
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % enabled.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + enabled.length) % enabled.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = enabled.length - 1;
    else return;

    event.preventDefault();
    const target = enabled[next]!;
    onChange(target.item.value);
    refs.current[target.itemIndex]?.focus();
  };

  return (
    <div
      className={cx(
        styles.tabs,
        variant === 'pill' ? styles.pill : styles.underline,
        size === 'sm' ? styles.sm : styles.md,
        className,
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item, index) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={item.disabled || undefined}
            disabled={item.disabled}
            title={item.title}
            className={cx(styles.tab, active && styles.active, item.disabled && styles.disabled)}
            onClick={() => {
              if (!item.disabled) onChange(item.value);
            }}
            onKeyDown={(event) => move(event, index)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
