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
  import Icon from './Icon.svelte';

  type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

  interface ModalProps {
    show: boolean;
    size?: ModalSize;
    title?: string;
    children?: Snippet;
    actions?: Snippet;
    onClose?: () => void;
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    customWidth?: string;
  }

  const {
    show,
    size = 'md',
    title,
    children,
    actions,
    onClose,
    closeOnBackdrop = true,
    closeOnEscape = true,
    customWidth,
  }: ModalProps = $props();

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-none w-11/12',
  };

  let modalElement: HTMLDivElement | undefined = $state();
  let previousActiveElement: Element | null = null;

  $effect(() => {
    if (show && modalElement) {
      previousActiveElement = document.activeElement;

      modalElement.focus();

      return () => {
        // Restore focus when modal closes
        if (previousActiveElement instanceof HTMLElement) {
          previousActiveElement.focus();
        }
      };
    }
  });

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget && closeOnBackdrop && onClose) {
      onClose();
    }
  }

  function handleModalKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && closeOnEscape && onClose) {
      event.preventDefault();
      onClose();
      return;
    }

    // Trap focus within modal on Tab
    if (event.key === 'Tab' && modalElement) {
      const focusableElements = modalElement.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );

      if (focusableElements.length === 0) return;

      const firstFocusable = focusableElements[0] as HTMLElement;
      const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (event.shiftKey) {
        // Shift + Tab - going backwards
        if (document.activeElement === firstFocusable || document.activeElement === modalElement) {
          event.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        // Tab - going forwards
        if (document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable?.focus();
        }
      }
    }
  }

  function handleCloseClick() {
    if (onClose) {
      onClose();
    }
  }
</script>

<!-- Modal -->
{#if show}
  <div
    bind:this={modalElement}
    class="modal-open modal z-[2147483648]"
    onclick={handleBackdropClick}
    onkeydown={handleModalKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby={title ? 'modal-title' : undefined}
    tabindex="0"
  >
    <div
      class="modal-box relative max-h-[90vh] overflow-auto {customWidth
        ? customWidth
        : sizeClasses[size]}"
      style="font-size: 16px !important; line-height: 1.5 !important; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji' !important;"
      transition:scale={{ duration: 200, easing: quintOut }}
    >
      <!-- Modal Header -->
      {#if title || onClose}
        <div class="mb-4 flex items-center justify-between">
          {#if title}
            <h2
              id="modal-title"
              class="text-base-content text-xl font-bold"
            >
              {title}
            </h2>
          {/if}
          {#if onClose}
            <button
              onclick={handleCloseClick}
              class="btn btn-circle btn-ghost btn-sm absolute top-2 right-2"
              aria-label="Close modal"
            >
              <Icon
                iconName="close"
                class="h-4 w-4"
              />
            </button>
          {/if}
        </div>
      {/if}

      <!-- content -->
      <div class={title || onClose ? 'mt-2' : ''}>
        {#if children}
          {@render children()}
        {/if}
      </div>

      <!-- actions -->
      {#if actions}
        <div class="modal-action">
          {@render actions()}
        </div>
      {/if}
    </div>
  </div>
{/if}
