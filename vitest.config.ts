import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
      '$app/environment': fileURLToPath(
        new URL('./tests/fixtures/app-environment.js', import.meta.url),
      ),
    },
  },
  test: {
    include: ['tests/**/*.test.{js,ts}'],
  },
});
