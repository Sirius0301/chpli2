import { useCallback, useEffect, useState } from 'react';

export interface StoredWidthOptions {
  defaultWidth: number;
  min: number;
  max: number;
}

export interface StoredWidth {
  width: number;
  setWidth: (width: number) => void;
  reset: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function readStoredWidth(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Persisted, clamped width for a resizable rail/panel. The debounce keeps
 * pointer-move updates out of localStorage while still surviving a reload.
 * Kept in the UI package so Memo and Notes share one behavior.
 */
export function useStoredWidth(key: string, options: StoredWidthOptions): StoredWidth {
  const { defaultWidth, min, max } = options;
  const [width, setWidthState] = useState(() => readStoredWidth(key, defaultWidth, min, max));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(key, String(width));
      } catch {
        /* storage unavailable: the session keeps the width */
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [key, width]);

  const setWidth = useCallback(
    (next: number) => setWidthState(clamp(next, min, max)),
    [min, max],
  );
  const reset = useCallback(() => setWidthState(defaultWidth), [defaultWidth]);

  return { width, setWidth, reset };
}
