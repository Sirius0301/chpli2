/** Converts an ISO 8601 string to the value format of <input type="datetime-local">. */
export function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Converts a <input type="datetime-local"> value to an ISO 8601 string (or null when empty). */
export function datetimeLocalToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Localized, user-timezone display format for an ISO 8601 string. */
export function formatDateTime(iso: string, language: string): string {
  return new Date(iso).toLocaleString(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
