import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';

export default defineConfig({
  plugins: [
    pluginReact(),
    pluginModuleFederation({
      name: 'bookmarks',
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/App.tsx',
      },
      // Subpath shares (react/, react-dom/) prevent duplicate react copies
      // from subpath imports like react-dom/client bypassing exact-name sharing.
      shared: {
        react: { singleton: true, requiredVersion: '18.3.1' },
        'react/': { singleton: true, requiredVersion: '18.3.1' },
        'react-dom': { singleton: true, requiredVersion: '18.3.1' },
        'react-dom/': { singleton: true, requiredVersion: '18.3.1' },
      },
    }),
  ],
  html: {
    template: './index.html',
  },
  server: {
    port: 3004,
    cors: true,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
