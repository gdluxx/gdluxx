import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  server: {
    port: 3001,
    host: 'localhost',
  },
  resolve: {
    alias: {
      '#src': path.resolve(__dirname, 'src'),

      '#app': path.resolve(__dirname, 'src/content/app'),
      '#views': path.resolve(__dirname, 'src/content/views'),
      '#assets': path.resolve(__dirname, 'src/content/assets'),

      '#components': path.resolve(__dirname, 'src/content/lib/components'),
      '#stores': path.resolve(__dirname, 'src/content/lib/stores'),

      '#utils/extract': path.resolve(__dirname, 'src/dev/mocks.ts'),
      '#utils/clipboard': path.resolve(__dirname, 'src/dev/mocks.ts'),
      '#utils/messaging': path.resolve(__dirname, 'src/dev/mocks.ts'),
      '#utils/storageProfiles': path.resolve(__dirname, 'src/dev/mocks.ts'),
      '#utils/persistence': path.resolve(__dirname, 'src/dev/mocks.ts'),
      '#utils': path.resolve(__dirname, 'src/content/lib/utils'), // Fallback

      // For local dev env
      '#src/content/overlayHost': path.resolve(__dirname, 'src/dev/mocks.ts'),
    },
  },
  root: '.',
  build: {
    rollupOptions: {
      input: {
        'dev-modal': 'dev-modal.html',
        'dev-popup': 'dev-popup.html',
      },
    },
  },
});
