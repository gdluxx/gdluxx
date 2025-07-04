<!--
  - Copyright (C) 2025 jsouthgb
  -
  - This file is part of gdluxx.
  -
  - gdluxx is free software; you can redistribute it and/or modify
  - it under the terms of the GNU General Public License version 2 (GPL-2.0),
  - as published by the Free Software Foundation.
  -->

<script lang="ts">
  import { onMount } from 'svelte';

  let isDark = $state(false);
  let isInitialized = $state(false);

  function applyTheme(dark: boolean): void {
    if (typeof document === 'undefined') {
      return;
    }

    const htmlEl = document.documentElement;
    if (dark) {
      htmlEl.classList.add('dark');
    } else {
      htmlEl.classList.remove('dark');
    }

    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  }

  function initializeTheme(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const storedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = storedTheme === 'dark' || (!storedTheme && prefersDark);

      isDark = shouldBeDark;
      applyTheme(shouldBeDark);
      isInitialized = true;
    } catch (error) {
      console.warn('Failed to initialize theme:', error);
      // Fallback to system preference
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(isDark);
      isInitialized = true;
    }
  }

  $effect(() => {
    if (isInitialized) {
      applyTheme(isDark);
    }
  });

  // Remove focus ring when user clicks theme toggle
  // But keep it for keyboard navigation for accessibility
  function handleThemeToggleClick(event: MouseEvent) {
    isDark = !isDark;

    if (event.detail > 0 && event.currentTarget) {
      const target = event.currentTarget as HTMLButtonElement | null;
      target?.blur();
    }
  }

  onMount(() => {
    initializeTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      try {
        const storedTheme = localStorage.getItem('theme');
        if (!storedTheme) {
          isDark = e.matches;
        }
      } catch {
        isDark = e.matches;
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  });
</script>
<!--  rounded-lg bg-secondary-100 dark:bg-secondary-800 hover:bg-secondary-200 dark:hover:bg-secondary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-secondary-50 dark:focus:ring-offset-secondary-900 transition-all duration-200 -->
<button
  type="button"
  class="cursor-pointer relative flex items-center justify-center w-10 h-10"
  aria-pressed={isDark}
  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
  onclick={handleThemeToggleClick}
>
  <!-- light mode -->
  <svg
    class="absolute w-6 h-6 text-primary-600 dark:text-primary-400 transition-all duration-400 {isDark ? 'opacity-0 rotate-180 scale-75' : 'opacity-100 rotate-0 scale-100'}"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
    />
  </svg>

  <!-- dark mode -->
  <svg
    class="absolute w-6 h-6 text-primary-600 dark:text-primary-400 transition-all duration-400 {isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-180 scale-75'}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      fill="currentColor"
      d="m17.75 4.09l-2.53 1.94l.91 3.06l-2.63-1.81l-2.63 1.81l.91-3.06l-2.53-1.94L12.44 4l1.06-3l1.06 3zm3.5 6.91l-1.64 1.25l.59 1.98l-1.7-1.17l-1.7 1.17l.59-1.98L15.75 11l2.06-.05L18.5 9l.69 1.95zm-2.28 4.95c.83-.08 1.72 1.1 1.19 1.85c-.32.45-.66.87-1.08 1.27C15.17 23 8.84 23 4.94 19.07c-3.91-3.9-3.91-10.24 0-14.14c.4-.4.82-.76 1.27-1.08c.75-.53 1.93.36 1.85 1.19c-.27 2.86.69 5.83 2.89 8.02a9.96 9.96 0 0 0 8.02 2.89m-1.64 2.02a12.08 12.08 0 0 1-7.8-3.47c-2.17-2.19-3.33-5-3.49-7.82c-2.81 3.14-2.7 7.96.31 10.98c3.02 3.01 7.84 3.12 10.98.31"
    />
  </svg>

  <!-- Screen reader, text only -->
  <span class="sr-only">
    {isDark ? 'Switch to light mode' : 'Switch to dark mode'}
  </span>
</button>
