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
    class="fixed inset-0 z-50 backdrop-blur-sm"
    onclick={handleBackdropClick}
    onkeydown={handleBackdropKeydown}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- Modal container -->
    <div class="fixed inset-0 flex items-center justify-center p-4">
      <div
        class="w-full rounded-lg bg-surface-elevated shadow-xl {sizeClasses[
          size
        ]} relative max-h-[90vh] overflow-auto"
        transition:scale={{ duration: 200, easing: quintOut }}
      >
        <!-- Close button -->
        {#if onClose}
          <div class="absolute top-4 right-4 z-10">
            <button
              onclick={onClose}
              class="inline-flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border-transparent bg-surface-hover text-muted-foreground transition-all hover:bg-surface-active focus:bg-surface-active focus:ring-2 focus:outline-hidden focus:border-focus"
              aria-label="Close modal"
            >
              <span class="sr-only">Close</span>
              <Icon
                iconName="close"
                size={12}
              />
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
