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
  import { Button } from '$lib/components/ui';
  import { Icon } from '$lib/components';

  type ButtonVariant =
    | 'default'
    | 'primary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'light'
    | 'dark'
    | 'outline-primary'
    | 'outline-success'
    | 'outline-warning'
    | 'outline-danger'
    | 'outline-info';

  type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

  interface ConfirmModalProps {
    show: boolean;
    title: string;
    message?: string;
    children?: Snippet;
    cancelText?: string;
    confirmText?: string;
    cancelVariant?: ButtonVariant;
    confirmVariant?: ButtonVariant;
    size?: ModalSize;
    showCloseButton?: boolean;
    preventEscapeClose?: boolean;
    preventBackdropClose?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    onClose?: () => void;
  }

  const {
    show = false,
    title,
    message,
    children,
    cancelText = 'Cancel',
    confirmText = 'Confirm',
    cancelVariant = 'outline-primary',
    confirmVariant = 'primary',
    size = 'md',
    showCloseButton = true,
    preventEscapeClose = false,
    preventBackdropClose = false,
    onCancel,
    onConfirm,
    onClose,
  }: ConfirmModalProps = $props();

  let modalElement: HTMLDivElement | undefined = $state();
  let previouslyFocusedElement: HTMLElement | null = $state(null);

  const sizeClasses: Record<ModalSize, string> = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
  };

  // Focus management
  $effect(() => {
    if (show) {
      previouslyFocusedElement = document.activeElement as HTMLElement;

      setTimeout(() => {
        if (modalElement) {
          const focusableElements = modalElement.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const firstElement = focusableElements[0] as HTMLElement;
          if (firstElement) {
            firstElement.focus();
          } else {
            modalElement.focus();
          }
        }
      }, 100);
    } else if (previouslyFocusedElement) {
      previouslyFocusedElement.focus();
      previouslyFocusedElement = null;
    }
  });

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !preventEscapeClose) {
      event.preventDefault();
      handleClose();
      return;
    }

    if (event.key === 'Tab' && modalElement) {
      const focusableElements = modalElement.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    }
  }

  function handleBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && !preventBackdropClose) {
      handleClose();
    }
  }

  function handleClose(): void {
    if (onClose) {
      onClose();
    } else {
      onCancel();
    }
  }

  function handleConfirm(): void {
    onConfirm();
  }

  function handleCancel(): void {
    onCancel();
  }

  const dialogClasses = $derived(
    [
      'w-full',
      'flex',
      'flex-col',
      'bg-surface-elevated',
      'border-strong',
      'shadow-xl',
      'rounded-sm',
      'pointer-events-auto',
      sizeClasses[size],
    ].join(' ')
  );
</script>

{#if show}
  <div
    bind:this={modalElement}
    class="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    aria-describedby={message ? 'modal-description' : undefined}
    tabindex="0"
  >
    <!-- Modal dialog -->
    <div
      class={dialogClasses}
      transition:scale={{ duration: 200, easing: quintOut, start: 0.95 }}
      role="document"
    >
      <!-- Header -->
      <div
        class="flex justify-between items-center py-4 px-6 border-b-primary/35"
      >
        <h1
          id="modal-title"
          class="text-lg font-semibold text-primary"
        >
          {title}
        </h1>

        {#if showCloseButton}
          <button
            type="button"
            onclick={handleClose}
            class="cursor-pointer flex-shrink-0 w-8 h-8 inline-flex justify-center items-center rounded-full border-primary/35 text-foreground hover:outline-hidden hover:ring-2 hover:ring-primary transition-all"
            aria-label="Close modal"
          >
            <span class="sr-only">Close</span>
            <Icon iconName="close" size={12} />
          </button>
        {/if}
      </div>

      <!-- content -->
      <div class="p-6 overflow-y-auto">
        {#if children}
          {@render children()}
        {:else if message}
          <p
            id="modal-description"
            class="text-foreground leading-relaxed"
          >
            {message}
          </p>
        {/if}
      </div>

      <!-- Footer -->
      <div
        class="flex justify-end items-center gap-3 py-4 px-6 border-t-primary/35"
      >
        <Button variant={cancelVariant} onclick={handleCancel} type="button">
          {cancelText}
        </Button>

        <Button variant={confirmVariant} onclick={handleConfirm} type="button">
          {confirmText}
        </Button>
      </div>
    </div>
  </div>
{/if}
