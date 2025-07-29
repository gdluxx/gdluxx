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
        ]} max-h-[90vh] overflow-auto"
        transition:scale={{ duration: 200, easing: quintOut }}
      >
        <!-- Close button -->
        {#if onClose}
          <div class="absolute top-4 right-4">
            <button
              onclick={onClose}
              class="text-secondary-400 hover:text-secondary-600 dark:text-secondary-500 dark:hover:text-secondary-300 transition-colors"
              aria-label="Close modal"
            >
              <Icon iconName="close" size={20} />
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
