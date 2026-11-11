import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // jsdom only exposes localStorage for non-opaque origins.
    environmentOptions: { jsdom: { url: 'https://localhost/' } },
    globals: true,
  },
});
