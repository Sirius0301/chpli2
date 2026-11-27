import { useState, type KeyboardEvent } from 'react';
import { Chip } from '../components/Chip';
import { cx } from '../cx';
import styles from './TagInput.module.css';

export type TagInputError = 'TAG_TOO_LONG' | 'TOO_MANY_TAGS';

export interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  maxCount: number;
  maxLength: number;
  placeholder: string;
  /** Accessible name for the free-text input. */
  addLabel: string;
  /** Build the localized remove label for each chip. */
  removeLabel: (tag: string) => string;
  /** Reports validation failures; `null` means the next add was accepted. */
  onError?: (reason: TagInputError | null) => void;
  className?: string;
  inputId?: string;
}

/**
 * Removable tag/category editor: Enter or comma adds, Backspace removes the
 * last chip, blur commits the pending text. The app owns error copy via
 * `onError`; the component never hardcodes user-facing text.
 */
export function TagInput({
  value,
  onChange,
  maxCount,
  maxLength,
  placeholder,
  addLabel,
  removeLabel,
  onError,
  className,
  inputId,
}: TagInputProps) {
  const [input, setInput] = useState('');

  const add = (raw: string) => {
    const tag = raw.trim();
    setInput('');
    if (!tag) return;
    if (tag.length > maxLength) {
      onError?.('TAG_TOO_LONG');
      return;
    }
    if (value.includes(tag)) return;
    if (value.length >= maxCount) {
      onError?.('TOO_MANY_TAGS');
      return;
    }
    onError?.(null);
    onChange([...value, tag]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(input);
      return;
    }
    if (event.key === 'Backspace' && !input && value.length > 0) {
      event.preventDefault();
      const next = value.slice(0, -1);
      onError?.(null);
      onChange(next);
    }
  };

  return (
    <div className={cx(styles.tags, className)}>
      {value.map((tag) => (
        <Chip
          key={tag}
          onRemove={() => {
            onError?.(null);
            onChange(value.filter((item) => item !== tag));
          }}
          removeLabel={removeLabel(tag)}
        >
          {tag}
        </Chip>
      ))}
      <input
        id={inputId}
        type="text"
        className={styles.input}
        value={input}
        maxLength={maxLength + 1}
        placeholder={placeholder}
        aria-label={addLabel}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(input)}
      />
    </div>
  );
}
