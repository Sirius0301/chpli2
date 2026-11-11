import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Module Federation remotes are virtual at dev time; stub them in tests.
      'travel/App': fileURLToPath(
        new URL('./src/__mocks__/remoteStub.tsx', import.meta.url),
      ),
      'calendar/App': fileURLToPath(
        new URL('./src/__mocks__/remoteStub.tsx', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
