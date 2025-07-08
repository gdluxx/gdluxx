import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    permissions: ['activeTab', 'storage'],
    host_permissions: ['https://*/*', 'http://*/*'],
    name: 'Tab URL Sender',
    description: 'Send current tab URL to a custom endpoint with API key',
    browser_specific_settings: {
      gecko: {
        id: 'gdluxx@gdluxx.app',
      },
    },
  },
});
