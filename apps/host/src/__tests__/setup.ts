/**
 * Test-environment bridge: Node >= 22 exposes an (empty) localStorage global
 * that shadows jsdom's, and vitest does not copy jsdom's Storage onto
 * globalThis. Provide a minimal in-memory Storage so app code that persists
 * language preferences works in unit tests.
 */
class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(String(key), String(value));
  }
}

if (typeof globalThis.localStorage === 'undefined' || globalThis.localStorage === undefined) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
}

export {};
