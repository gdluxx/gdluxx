import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';

export default defineConfig({
  vite: () => ({
    plugins: [svelte(), tailwindcss()],
    resolve: {
      alias: {
        '#src': path.resolve(__dirname, 'src'),

        '#app': path.resolve(__dirname, 'src/content/app'),
        '#views': path.resolve(__dirname, 'src/content/views'),
        '#assets': path.resolve(__dirname, 'src/content/assets'),

        '#components': path.resolve(__dirname, 'src/content/lib/components'),
        '#stores': path.resolve(__dirname, 'src/content/lib/stores'),
        '#utils': path.resolve(__dirname, 'src/content/lib/utils'),
      },
    },
    build: {
      minify: true,
      sourcemap: false,
    },
  }),
  manifest: ({ browser }) => ({
    permissions: ['activeTab', 'storage', 'contextMenus', 'notifications', 'scripting'],
    ...(browser === 'firefox'
      ? { optional_permissions: ['<all_urls>'] } // Firefox MV2
      : { optional_host_permissions: ['<all_urls>'] }), // Chrome MV3
    name: 'gdluxx-extension',
    description: 'companion browser extension for gdluxx, a self-hosted browser GUI for gallery-dl',
    browser_specific_settings: {
      gecko: {
        id: 'gdluxx@gdluxx.app',
      },
    },
  }),
});
