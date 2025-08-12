import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  vite: () => ({
    plugins: [tailwindcss()],
    build: {
      minify: false,
      sourcemap: false,
    },
  }),
  manifest: {
    permissions: ['activeTab', 'storage', 'contextMenus', 'notifications'],
    name: 'gdluxx-extension',
    description: 'companion browser extension for gdluxx, a self-hosted browser GUI for gallery-dl',
    browser_specific_settings: {
      gecko: {
        id: 'gdluxx@gdluxx.app',
      },
    },
  },
});
