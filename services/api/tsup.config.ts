import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['cjs'],
  target: 'node20',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  // The shared package ships TypeScript sources (ESM). Bundle it so the
  // production CJS output has no runtime dependency on TS/ESM resolution.
  noExternal: ['@chpli2/shared'],
});
