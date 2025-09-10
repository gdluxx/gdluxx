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
  import { type Toast, toastStore } from '$lib/stores/toast';
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
      container: 'bg-surface-overlay border-success',
      icon: 'bg-success text-on-success',
      title: 'text-foreground',
      message: 'text-muted-foreground',
      close: 'text-success hover:text-success-hover',
      closeButton: 'hover:bg-success/10 focus:ring-success',
    },
    error: {
      container: 'bg-surface-overlay border-error',
      icon: 'bg-error text-on-error',
      title: 'text-foreground',
      message: 'text-muted-foreground',
      close: 'text-error hover:text-error-hover',
      closeButton: 'hover:bg-error/10 focus:ring-error',
    },
    warning: {
      container: 'bg-surface-overlay border-warning',
      icon: 'bg-warning text-on-warning',
      title: 'text-foreground',
      message: 'text-muted-foreground',
      close: 'text-warning hover:text-warning-hover',
      closeButton: 'hover:bg-warning/10 focus:ring-warning',
    },
    info: {
      container: 'bg-surface-overlay border-info',
      icon: 'bg-info text-on-info',
      title: 'text-foreground',
      message: 'text-muted-foreground',
      close: 'text-info hover:text-info-hover',
      closeButton: 'hover:bg-info/10 focus:ring-info',
    },
  };

  $: styles = styleMap[toast.type];

  function handleClose() {
    toastStore.removeToast(toast.id);
  }
</script>

<div
  class="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg border-l-8 shadow-lg {styles.container}"
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
      <div class="ml-4 flex flex-shrink-0">
        <button
          type="button"
          class="inline-flex cursor-pointer rounded-sm p-1.5 transition-colors duration-150 focus:ring-1 focus:ring-offset-1 focus:outline-none {styles.close} {styles.closeButton}"
          onclick={handleClose}
        >
          <span class="sr-only">Close</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 fill-current"
            viewBox="0 0 48 48"
          >
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
