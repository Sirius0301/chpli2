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
      },
      shared: {
        react: { singleton: true, requiredVersion: '18.3.1' },
        'react-dom': { singleton: true, requiredVersion: '18.3.1' },
      },
    }),
  ],
  server: {
    port: 3000,
    cors: true,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
