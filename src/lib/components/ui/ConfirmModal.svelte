<script lang="ts">
  import type { Snippet } from 'svelte';
  import { scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { Button } from '$lib/components/ui';

  type ButtonVariant =
    | 'default'
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'light'
    | 'dark'
    | 'outline-primary'
    | 'outline-secondary'
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
    cancelVariant = 'outline-secondary',
    confirmVariant = 'primary',
    size = 'md',
    showCloseButton = true,
    preventEscapeClose = false,
    preventBackdropClose = false,
    onCancel,
    onConfirm,
    onClose,
  }: ConfirmModalProps = $props();

  const sizeClasses: Record<ModalSize, string> = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
  };

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !preventEscapeClose) {
      event.preventDefault();
      handleClose();
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
      'bg-white',
      'border',
      'border-secondary-200',
      'shadow-xl',
      'rounded-lg',
      'pointer-events-auto',
      'dark:bg-secondary-800',
      'dark:border-secondary-700',
      sizeClasses[size],
    ].join(' ')
  );
</script>

{#if show}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    aria-describedby={message ? 'modal-description' : undefined}
    tabindex="-1"
  >
    <!-- Modal dialog -->
    <div
      class={dialogClasses}
      transition:scale={{ duration: 200, easing: quintOut, start: 0.95 }}
      role="document"
    >
      <!-- Header -->
      <div
        class="flex justify-between items-center py-4 px-6 border-b border-secondary-200 dark:border-secondary-700"
      >
        <h3
          id="modal-title"
          class="text-lg font-semibold text-secondary-900 dark:text-secondary-100"
        >
          {title}
        </h3>

        {#if showCloseButton}
          <button
            type="button"
            onclick={handleClose}
            class="cursor-pointer flex-shrink-0 w-8 h-8 inline-flex justify-center items-center rounded-full border border-transparent bg-secondary-100 text-secondary-800 hover:bg-secondary-200 focus:outline-hidden focus:bg-secondary-200 focus:ring-2 focus:ring-secondary-300 transition-all dark:bg-secondary-700 dark:hover:bg-secondary-600 dark:text-secondary-400 dark:focus:bg-secondary-600 dark:focus:ring-secondary-500"
            aria-label="Close modal"
          >
            <span class="sr-only">Close</span>
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
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
            class="text-secondary-700 dark:text-secondary-300 leading-relaxed"
          >
            {message}
          </p>
        {/if}
      </div>

      <!-- Footer -->
      <div
        class="flex justify-end items-center gap-3 py-4 px-6 border-t border-secondary-200 dark:border-secondary-700"
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
