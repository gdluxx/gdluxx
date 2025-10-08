import type { Config } from 'tailwindcss';

export default {
  content: [
    './entrypoints/**/*.{js,ts,jsx,tsx,html}',
    './utils/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx,svelte}',
  ],
} satisfies Config;
