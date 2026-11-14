import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';

export default defineConfig({
  plugins: [
    pluginReact(),
    pluginModuleFederation({
      name: 'host',
      remotes: {
        travel: 'travel@http://localhost:3001/remoteEntry.js',
        calendar: 'calendar@http://localhost:3002/remoteEntry.js',
        notes: 'notes@http://localhost:3003/remoteEntry.js',
        bookmarks: 'bookmarks@http://localhost:3004/remoteEntry.js',
        growth: 'growth@http://localhost:3005/remoteEntry.js',
      },
      // Host is the entry app: its shared react must be eager so the entry
      // never calls loadShareSync before the share scope is initialized
      // (Module Federation RUNTIME-006). Subpath shares avoid duplicate copies
      // of react-dom/client etc. in remotes.
      shared: {
        react: { singleton: true, requiredVersion: '18.3.1', eager: true },
        'react/': { singleton: true, requiredVersion: '18.3.1', eager: true },
        'react-dom': { singleton: true, requiredVersion: '18.3.1', eager: true },
        'react-dom/': { singleton: true, requiredVersion: '18.3.1', eager: true },
      },
    }),
  ],
  html: {
    template: './index.html',
  },
  source: {
    // M5: extra origins allowed to drive the Portal postMessage bridge (D3).
    // Comma-separated; same-origin parents are always allowed.
    define: {
      'process.env.PORTAL_ORIGINS': JSON.stringify(process.env.PORTAL_ORIGINS ?? ''),
    },
  },
  server: {
    port: 3000,
    cors: true,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
