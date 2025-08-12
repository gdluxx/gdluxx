import type { Config } from 'tailwindcss';

export default {
  content: [
    './entrypoints/**/*.{js,ts,jsx,tsx,html}',
    './components/**/*.{js,ts,jsx,tsx}',
    './utils/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f8f9fb',
          100: '#f1f3f7',
          200: '#e2e7ef',
          300: '#d1d9e3',
          400: '#a8b8d1',
          500: '#7a8eb8',
          600: '#5d72a0',
          700: '#4a5d85',
          800: '#3a4b6b',
          900: '#2d3a52',
          950: '#1e2638',
        },
        secondary: {
          50: '#f9f9fa',
          100: '#f3f4f5',
          200: '#e5e7ea',
          300: '#d3d6db',
          400: '#b0b6bf',
          500: '#8b93a0',
          600: '#6b7685',
          700: '#555d6b',
          800: '#424952',
          900: '#32373e',
          950: '#21252b',
        },
        accent: {
          50: '#f7f8fb',
          100: '#eff2f6',
          200: '#dde4ed',
          300: '#c8d3e0',
          400: '#a3b5cc',
          500: '#7d92b3',
          600: '#637699',
          700: '#526180',
          800: '#434f66',
          900: '#363f4d',
          950: '#252b35',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
