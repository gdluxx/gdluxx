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
  import type { Snippet } from 'svelte';
  import { scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { Icon } from '$lib/components';

  type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

  interface ModalProps {
    show: boolean;
    size?: ModalSize;
    children?: Snippet;
    onClose?: () => void;
  }

  const { show, size = 'md', children, onClose }: ModalProps = $props();

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget && onClose) {
      onClose();
    }
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (event.target === event.currentTarget && onClose) {
        onClose();
      }
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && onClose) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
  <!-- Modal backdrop -->
  <div
    class="fixed inset-0 backdrop-blur-sm z-50"
    onclick={handleBackdropClick}
    onkeydown={handleBackdropKeydown}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- Modal container -->
    <div class="fixed inset-0 flex items-center justify-center p-4">
      <div
        class="bg-white dark:bg-secondary-800 rounded-lg shadow-xl w-full {sizeClasses[
          size
        ]} max-h-[90vh] overflow-auto relative"
        transition:scale={{ duration: 200, easing: quintOut }}
      >
        <!-- Close button -->
        {#if onClose}
          <div class="absolute top-4 right-4 z-10">
            <button
              onclick={onClose}
              class="cursor-pointer flex-shrink-0 w-8 h-8 inline-flex justify-center items-center rounded-full border border-transparent bg-secondary-100 text-secondary-800 hover:bg-secondary-200 focus:outline-hidden focus:bg-secondary-200 focus:ring-2 focus:ring-secondary-300 transition-all dark:bg-secondary-700 dark:hover:bg-secondary-600 dark:text-secondary-400 dark:focus:bg-secondary-600 dark:focus:ring-secondary-500"
              aria-label="Close modal"
            >
              <span class="sr-only">Close</span>
              <Icon iconName="close" size={12} />
            </button>
          </div>
        {/if}

        <!-- Modal content -->
        {#if children}
          {@render children()}
        {/if}
      </div>
    </div>
  </div>
{/if}
