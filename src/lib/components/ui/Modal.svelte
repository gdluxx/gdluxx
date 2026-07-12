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
  import { Icon } from '$lib/components';

  type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

  interface ModalProps {
    show: boolean;
    size?: ModalSize;
    closeOnEscape?: boolean;
    children?: Snippet;
    onClose?: () => void;
  }

  const { show, size = 'md', closeOnEscape = true, children, onClose }: ModalProps = $props();

  let dialogElement = $state<HTMLDialogElement>();

  const sizeClasses: Record<ModalSize, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  // Drive the native <dialog> from the `show` prop. showModal() gives us focus
  // trapping (inert background), top-layer stacking, and automatic focus
  // restore to the previously focused element for free. This effect only runs
  // client side, so guarded dialogElement access is SSR-safe.
  $effect(() => {
    const dialog = dialogElement;
    if (!dialog) {
      return;
    }

    if (show && !dialog.open) {
      dialog.showModal();
    } else if (!show && dialog.open) {
      dialog.close();
    }

    // Ensure the dialog is closed on unmount so the page is never left inert or
    // scroll-locked (also runs before each re-execution, which is harmless).
    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  });

  // The `cancel` event fires on Escape (and other UA-initiated dismissals). We
  // always preventDefault so the dialog can never close itself out of sync with
  // the `show` prop; the parent's `show` state stays the single source of
  // truth. We then defer to onClose only when Escape-close is allowed. When
  // onClose is undefined, nothing closes and the parent stays in control.
  function handleCancel(event: Event): void {
    event.preventDefault();
    if (closeOnEscape) {
      onClose?.();
    }
  }

  // Click-outside: a click whose target is the dialog element itself lands on
  // the ::backdrop region (the content wrapper fills the dialog, so inner
  // clicks never match). The dialog has no padding, so there is no padding area
  // that would falsely read as "outside".
  function handleClick(event: MouseEvent): void {
    if (event.target === dialogElement) {
      onClose?.();
    }
  }
</script>

<dialog
  bind:this={dialogElement}
  class="modal m-auto w-[calc(100vw-2rem)] {sizeClasses[
    size
  ]} max-h-[90vh] overflow-auto rounded-lg bg-surface-elevated p-0 shadow-xl"
  oncancel={handleCancel}
  onclick={handleClick}
>
  <!-- Content wrapper: fills the dialog so inner clicks never equal the dialog
       target, and is `relative` so the close button positions against it. -->
  <div class="relative">
    {#if children}
      {@render children()}
    {/if}

    <!-- Close button rendered after content so it does not steal initial focus
         from the first form field; absolute positioning keeps it top-right. -->
    {#if onClose}
      <div class="absolute top-4 right-4 z-10">
        <button
          type="button"
          onclick={onClose}
          class="inline-flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border-transparent bg-surface-hover text-muted-foreground transition-all hover:bg-surface-active focus:border-focus focus:bg-surface-active focus:ring-2 focus:outline-hidden"
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
  </div>
</dialog>

<style>
  /* Reset UA dialog chrome; surface/rounding/shadow come from utility classes. */
  .modal {
    border: none;
  }

  /* CSS @starting-style + allow-discrete drives both enter and exit through the top layer */
  .modal {
    opacity: 0;
    transform: scale(0.95);
    transition:
      opacity 200ms ease,
      transform 200ms ease,
      overlay 200ms ease allow-discrete,
      display 200ms ease allow-discrete;
  }

  .modal[open] {
    opacity: 1;
    transform: scale(1);
  }

  @starting-style {
    .modal[open] {
      opacity: 0;
      transform: scale(0.95);
    }
  }

  .modal::backdrop {
    background-color: rgb(0 0 0 / 0.3);
    backdrop-filter: blur(4px);
    opacity: 0;
    transition:
      opacity 200ms ease,
      overlay 200ms ease allow-discrete,
      display 200ms ease allow-discrete;
  }

  .modal[open]::backdrop {
    opacity: 1;
  }

  @starting-style {
    .modal[open]::backdrop {
      opacity: 0;
    }
  }
</style>
