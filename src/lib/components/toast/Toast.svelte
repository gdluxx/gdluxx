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
  import { type Toast, toastStore } from '$lib/stores/toast.js';
  import { fly } from 'svelte/transition';

  export let toast: Toast;

  const iconMap = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  const styleMap = {
    success: {
      container: 'dark:bg-success-100 border-success-500 bg-success-900',
      icon: 'bg-success-500 text-white',
      title: 'dark:text-success-900 text-success-100',
      message: 'dark:text-success-750 text-success-250',
      close: 'text-success-500 dark:hover:text-success-700 hover:text-success-300',
      ex: 'rounded-lg text-success-250 hover:bg-success-500 hover:text-success-100 dark:text-success-750 dark:hover:text-success-900 dark:hover:bg-success-500',
    },
    error: {
      container: 'bg-error-100 border-error-500 dark:bg-error-900',
      icon: 'bg-error-500 text-white',
      title: 'text-error-900 dark:text-error-100',
      message: 'text-error-700 dark:text-error-300',
      close: 'text-error-500 hover:text-error-700 dark:hover:text-error-300',
      ex: 'rounded-lg text-info-250 hover:bg-info-500 hover:text-info-100 dark:text-info-750 dark:hover:text-info-900 dark:hover:bg-info-500',
    },
    warning: {
      container: 'bg-warning-100 border-warning-500 dark:bg-warning-900',
      icon: 'bg-warning-500 text-white',
      title: 'text-warning-900 dark:text-warning-100',
      message: 'text-warning-700 dark:text-warning-300',
      close: 'text-warning-500 hover:text-warning-700 dark:hover:text-warning-300',
      ex: 'rounded-lg text-warning-250 hover:bg-warning-500 hover:text-warning-100 dark:text-warning-750 dark:hover:text-warning-900 dark:hover:bg-warning-500',
    },
    info: {
      container: 'dark:bg-info-100 border-info-500 bg-info-900',
      icon: 'bg-info-500 text-white',
      title: 'dark:text-info-900 text-info-100',
      message: 'dark:text-info-750 text-info-250',
      close: 'text-info-500 dark:hover:text-info-700 hover:bg-info-750 hover:text-info-300',
      ex: 'rounded-lg text-info-250 hover:bg-info-500 hover:text-info-100 dark:text-info-750 dark:hover:text-info-900 dark:hover:bg-info-500',
    },
  };

  $: styles = styleMap[toast.type];

  function handleClose() {
    toastStore.removeToast(toast.id);
  }
</script>

<div
  class="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg border-l-4 shadow-lg {styles.container}"
  transition:fly={{ x: 400, duration: 300 }}
>
  <div class="p-4">
    <div class="flex items-start">
      <!-- Icon -->
      <div class="flex-shrink-0">
        <div
          class="flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold {styles.icon}"
        >
          {iconMap[toast.type]}
        </div>
      </div>

      <!-- Content -->
      <div class="ml-3 w-0 flex-1">
        <h4 class="text-sm font-semibold {styles.title}">
          {#if toast.allowHtml}
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html toast.title}
          {:else}
            {toast.title}
          {/if}
        </h4>
        {#if toast.message}
          <p class="mt-1 text-sm {styles.message}">
            {#if toast.allowHtml}
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html toast.message}
            {:else}
              {toast.message}
            {/if}
          </p>
        {/if}
      </div>

      <!-- Close Button -->
      <div class="ml-4 flex flex-shrink-0 transition-colors {styles.ex}">
        <button
          type="button"
          class="cursor-pointer inline-flex rounded-md p-1.5 duration-150 focus:outline-none focus:ring-1 focus:ring-offset-1"
          onclick={handleClose}
        >
          <span class="sr-only">Close</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 fill-current" viewBox="0 0 48 48">
            <path
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="4"
              d="m8 8l32 32M8 40L40 8"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
</div>
