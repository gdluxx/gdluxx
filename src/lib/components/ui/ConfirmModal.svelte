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
  import { Button } from '$lib/components/ui';
  import Modal from './Modal.svelte';

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
    // showCloseButton/preventBackdropClose are kept for API stability. The
    // native <dialog> Modal always renders its close button and treats a
    // backdrop click as a dismiss (which maps to cancel here), so these are
    // accepted but not separately wired
    showCloseButton: _showCloseButton = true,
    preventEscapeClose = false,
    preventBackdropClose: _preventBackdropClose = false,
    onCancel,
    onConfirm,
    onClose,
  }: ConfirmModalProps = $props();

  // Escape, backdrop-click and the Modal's close button all resolve to the same
  // dismiss intent. ConfirmModal has an explicit Cancel action, so a dismissal
  // maps to onClose when provided, otherwise to onCancel
  function handleClose(): void {
    if (onClose) {
      onClose();
    } else {
      onCancel();
    }
  }
</script>

<Modal
  {show}
  {size}
  closeOnEscape={!preventEscapeClose}
  onClose={handleClose}
>
  <div class="flex w-full flex-col">
    <!-- Header -->
    <div class="flex items-center border-b-strong px-6 py-4 pr-14">
      <h1
        id="modal-title"
        class="text-lg font-semibold text-primary"
      >
        {title}
      </h1>
    </div>

    <!-- Content -->
    <div class="overflow-y-auto p-6">
      {#if children}
        {@render children()}
      {:else if message}
        <p
          id="modal-description"
          class="leading-relaxed text-foreground"
        >
          {message}
        </p>
      {/if}
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-end gap-3 border-t-strong px-6 py-4">
      <Button
        variant={cancelVariant}
        onclick={onCancel}
        type="button"
        size="sm"
      >
        {cancelText}
      </Button>

      <Button
        variant={confirmVariant}
        onclick={onConfirm}
        type="button"
        size="sm"
      >
        {confirmText}
      </Button>
    </div>
  </div>
</Modal>
